use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub mtime: u64,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub mtime: u64,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

fn mtime_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn hash_bytes(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

fn open_file_sync(path: String) -> AppResult<FileContent> {
    let p = PathBuf::from(&path);
    let meta = fs::metadata(&p).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound(path.clone()),
        _ => AppError::Io(e),
    })?;
    if !meta.is_file() {
        return Err(AppError::InvalidPath(path));
    }
    let bytes = fs::read(&p)?;
    let content = String::from_utf8(bytes).map_err(|_| AppError::NotUtf8)?;
    Ok(FileContent {
        path,
        hash: hash_bytes(content.as_bytes()),
        size: meta.len(),
        mtime: mtime_ms(&meta),
        content,
    })
}

#[tauri::command]
pub async fn open_file(path: String) -> AppResult<FileContent> {
    tauri::async_runtime::spawn_blocking(move || open_file_sync(path))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

fn atomic_write(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let dir = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath(path.to_string_lossy().to_string()))?;
    fs::create_dir_all(dir)?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled");
    let tmp = dir.join(format!(
        ".{}.rypora-{}.tmp",
        file_name,
        std::process::id()
    ));

    {
        let mut file = File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }

    #[cfg(windows)]
    {
        if path.exists() {
            fs::remove_file(path)?;
        }
    }

    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AppError::Io(e)
    })?;

    // Best-effort directory fsync so the rename is durable on crash.
    #[cfg(unix)]
    {
        if let Ok(dir_file) = File::open(dir) {
            let _ = dir_file.sync_all();
        }
    }

    Ok(())
}

fn save_file_sync(
    path: String,
    content: String,
    expected_mtime: Option<u64>,
    expected_hash: Option<String>,
) -> AppResult<SaveResult> {
    let p = PathBuf::from(&path);
    if let Ok(meta) = fs::metadata(&p) {
        let current_mtime = mtime_ms(&meta);
        let mtime_mismatch = expected_mtime.is_some_and(|m| m != current_mtime);
        let hash_mismatch = match expected_hash {
            Some(expected) => match fs::read(&p) {
                Ok(bytes) => hash_bytes(&bytes) != expected,
                Err(_) => true,
            },
            None => false,
        };
        if mtime_mismatch || hash_mismatch {
            return Err(AppError::Conflict { current_mtime });
        }
    } else if expected_mtime.is_some() {
        return Err(AppError::Conflict { current_mtime: 0 });
    }

    atomic_write(&p, content.as_bytes())?;

    let meta = fs::metadata(&p)?;
    Ok(SaveResult {
        mtime: mtime_ms(&meta),
        size: meta.len(),
        hash: hash_bytes(content.as_bytes()),
    })
}

#[tauri::command]
pub async fn save_file(
    path: String,
    content: String,
    expected_mtime: Option<u64>,
    expected_hash: Option<String>,
) -> AppResult<SaveResult> {
    tauri::async_runtime::spawn_blocking(move || {
        save_file_sync(path, content, expected_mtime, expected_hash)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        atomic_write(Path::new(&path), content.as_bytes())
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | "target" | "dist" | "build" | "__pycache__" | ".DS_Store"
    ) || name.starts_with('.')
}

fn walk_dir(dir: &Path, depth: usize, max_depth: usize) -> Vec<FileNode> {
    if depth > max_depth {
        return Vec::new();
    }
    let Ok(read) = fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut entries: Vec<FileNode> = Vec::new();
    for entry in read.flatten().take(4000) {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let path_string = path.to_string_lossy().to_string();
        if file_type.is_dir() {
            entries.push(FileNode {
                name,
                path: path_string,
                is_dir: true,
                children: Some(walk_dir(&path, depth + 1, max_depth)),
            });
        } else if file_type.is_file() {
            entries.push(FileNode {
                name,
                path: path_string,
                is_dir: false,
                children: None,
            });
        }
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    entries
}

#[tauri::command]
pub async fn read_dir_tree(root: String, max_depth: Option<usize>) -> AppResult<Vec<FileNode>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&root);
        if !path.is_dir() {
            return Err(AppError::InvalidPath(root));
        }
        Ok(walk_dir(&path, 0, max_depth.unwrap_or(12)))
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn create_file(path: String) -> AppResult<FileContent> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&path);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent)?;
        }
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&p)
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::AlreadyExists {
                    AppError::Other(format!("文件已存在：{path}"))
                } else {
                    AppError::Io(e)
                }
            })?;
        open_file_sync(path)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn create_folder(path: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(Path::new(&path))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = Path::new(&to);
        if target.exists() {
            return Err(AppError::Other(format!("目标已存在：{to}")));
        }
        fs::rename(Path::new(&from), target)?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn delete_path(path: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        trash::delete(Path::new(&path)).map_err(|e| AppError::Other(e.to_string()))
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn sanitize_file_name(name: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image.png");
    base.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn save_image_sync(doc_dir: &Path, file_name: &str, bytes: &[u8]) -> AppResult<String> {
    let assets = doc_dir.join("assets");
    fs::create_dir_all(&assets)?;

    let safe = sanitize_file_name(file_name);
    let path = Path::new(&safe);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png");

    let mut candidate = assets.join(format!("{stem}.{ext}"));
    let mut index = 1;
    while candidate.exists() {
        candidate = assets.join(format!("{stem}-{index}.{ext}"));
        index += 1;
    }

    fs::write(&candidate, bytes)?;
    Ok(format!(
        "assets/{}",
        candidate
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png")
    ))
}

#[tauri::command]
pub async fn save_image(doc_dir: String, file_name: String, bytes: Vec<u8>) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        save_image_sync(Path::new(&doc_dir), &file_name, &bytes)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn import_image(
    doc_path: Option<String>,
    root: Option<String>,
    source_path: String,
) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let doc_dir = doc_path
            .as_deref()
            .and_then(|p| Path::new(p).parent())
            .map(|p| p.to_path_buf())
            .or_else(|| root.map(PathBuf::from))
            .ok_or_else(|| AppError::Other("请先打开或保存文档，再插入图片".into()))?;
        let bytes = fs::read(&source_path)?;
        let name = Path::new(&source_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("image.png");
        save_image_sync(&doc_dir, name, &bytes)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}
