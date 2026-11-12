use crate::error::{AppError, AppResult};
use ignore::WalkBuilder;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub preview: String,
    pub match_len: u32,
}

fn make_preview(line: &str, char_start: usize, match_len: usize) -> String {
    let chars: Vec<char> = line.chars().collect();
    let context = 48usize;
    let start = char_start.saturating_sub(context);
    let end = (char_start + match_len + context).min(chars.len());
    let mut out = String::new();
    if start > 0 {
        out.push('…');
    }
    out.extend(&chars[start..end]);
    if end < chars.len() {
        out.push('…');
    }
    out
}

/// Lowercase a line while remembering which original character produced each
/// byte of the lowercased string. Unicode lowercasing may change byte lengths
/// (e.g. `İ`), so byte offsets from the lowercased text cannot be used on the
/// original string directly.
fn lowercase_with_map(line: &str) -> (String, Vec<usize>) {
    let mut lower = String::with_capacity(line.len());
    let mut map: Vec<usize> = Vec::with_capacity(line.len() + 1);
    for (char_index, ch) in line.chars().enumerate() {
        for lower_char in ch.to_lowercase() {
            lower.push(lower_char);
            for _ in 0..lower_char.len_utf8() {
                map.push(char_index);
            }
        }
    }
    map.push(line.chars().count());
    (lower, map)
}

fn identity_map(line: &str) -> Vec<usize> {
    let mut map: Vec<usize> = Vec::with_capacity(line.len() + 1);
    for (char_index, ch) in line.chars().enumerate() {
        for _ in 0..ch.len_utf8() {
            map.push(char_index);
        }
    }
    map.push(line.chars().count());
    map
}

/// Returns the character offsets of every match of `needle` in `line`.
fn match_offsets(line: &str, needle: &str, case_sensitive: bool) -> Vec<usize> {
    let (haystack, map) = if case_sensitive {
        (line.to_string(), identity_map(line))
    } else {
        lowercase_with_map(line)
    };

    let mut offsets = Vec::new();
    let mut offset = 0usize;
    while offset <= haystack.len() {
        let Some(found) = haystack[offset..].find(needle) else {
            break;
        };
        let byte_index = offset + found;
        offsets.push(map.get(byte_index).copied().unwrap_or(0));
        let advance = needle.len().max(1);
        offset = byte_index + advance;
        if offset > haystack.len() {
            break;
        }
    }
    offsets
}

fn search_sync(
    root: String,
    query: String,
    case_sensitive: bool,
    max_results: usize,
) -> AppResult<Vec<SearchHit>> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    if !Path::new(&root).is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let needle = if case_sensitive {
        query.clone()
    } else {
        query.to_lowercase()
    };
    let match_len = needle.chars().count().max(1) as u32;

    let mut hits: Vec<SearchHit> = Vec::new();
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            name != "node_modules" && name != "target" && name != "dist"
        })
        .build();

    'outer: for entry in walker.filter_map(Result::ok) {
        if hits.len() >= max_results {
            break;
        }
        let is_file = entry.file_type().is_some_and(|t| t.is_file());
        if !is_file {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() > 2_000_000 {
            continue;
        }
        let Ok(bytes) = fs::read(entry.path()) else {
            continue;
        };
        if bytes.contains(&0) {
            continue;
        }
        let Ok(text) = String::from_utf8(bytes) else {
            continue;
        };
        let path = entry.path().to_string_lossy().to_string();

        for (index, line) in text.lines().enumerate() {
            for char_start in match_offsets(line, &needle, case_sensitive) {
                hits.push(SearchHit {
                    path: path.clone(),
                    line: index as u32 + 1,
                    column: char_start as u32 + 1,
                    preview: make_preview(line, char_start, match_len as usize),
                    match_len,
                });
                if hits.len() >= max_results {
                    break 'outer;
                }
            }
        }
    }

    Ok(hits)
}

#[tauri::command]
pub async fn search_workspace(
    root: String,
    query: String,
    case_sensitive: bool,
    max_results: Option<usize>,
) -> AppResult<Vec<SearchHit>> {
    tauri::async_runtime::spawn_blocking(move || {
        search_sync(root, query, case_sensitive, max_results.unwrap_or(200))
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}
