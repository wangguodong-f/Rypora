mod commands;
mod error;
mod menu;
mod watcher;

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use watcher::WatcherState;

/// Files handed to a window before its frontend was ready (macOS `open`,
/// Finder double-click, a command line argument, or "new window with file").
#[derive(Default)]
struct PendingOpen(Mutex<HashMap<String, Vec<String>>>);

/// Recently opened files, kept in the backend so the native menu can list them.
#[derive(Default)]
struct RecentFiles(Mutex<Vec<String>>);

static WINDOW_COUNTER: AtomicUsize = AtomicUsize::new(1);

const OPENABLE_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdx", "txt"];

fn is_openable(path: &std::path::Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| OPENABLE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
            .unwrap_or(false)
}

fn urls_to_paths(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|path| is_openable(path))
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

/// The window a menu command or an `open` event should apply to.
fn focused_window<R: Runtime>(app: &AppHandle<R>) -> Option<tauri::WebviewWindow<R>> {
    app.webview_windows()
        .into_iter()
        .find(|(_, window)| window.is_focused().unwrap_or(false))
        .map(|(_, window)| window)
        .or_else(|| app.get_webview_window("main"))
}

fn queue_pending<R: Runtime>(app: &AppHandle<R>, label: &str, paths: &[String]) {
    let pending = app.state::<PendingOpen>();
    let mut map = pending.0.lock().expect("pending open lock poisoned");
    map.entry(label.to_string())
        .or_default()
        .extend(paths.iter().cloned());
}

/// Frontends drain this once on mount, then rely on `app://open-files`.
#[tauri::command]
fn take_pending_files(window: String, state: tauri::State<'_, PendingOpen>) -> Vec<String> {
    let mut map = state.0.lock().expect("pending open lock poisoned");
    map.remove(&window).unwrap_or_default()
}

/// Replace the recent-file list shown in **File → Open Recent**.
#[tauri::command]
fn set_recent_files<R: Runtime>(
    app: AppHandle<R>,
    files: Vec<String>,
) -> Result<(), String> {
    {
        let recent = app.state::<RecentFiles>();
        let mut list = recent.0.lock().expect("recent files lock poisoned");
        *list = files.clone();
    }
    let menu = menu::build_menu(&app, &files).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}

/// Open another editor window, optionally with a file queued for it.
#[tauri::command]
fn new_window<R: Runtime>(app: AppHandle<R>, path: Option<String>) -> Result<(), String> {
    let index = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("doc-{index}");

    let mut builder = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Rypora")
    .inner_size(1280.0, 820.0)
    .min_inner_size(760.0, 480.0)
    .hidden_title(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder.title_bar_style(tauri::TitleBarStyle::Overlay);
    }

    let window = builder.build().map_err(|error| error.to_string())?;

    if let Some(path) = path {
        queue_pending(&app, &label, &[path]);
    }

    let _ = window.set_focus();
    Ok(())
}

/// Bring every window to the front, macOS "Bring All to Front".
#[tauri::command]
fn focus_all_windows<R: Runtime>(app: AppHandle<R>) {
    for (_, window) in app.webview_windows() {
        let _ = window.show();
        let _ = window.unminimize();
    }
    if let Some(window) = focused_window(&app) {
        let _ = window.set_focus();
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(WatcherState::default())
        .manage(PendingOpen::default())
        .manage(RecentFiles::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::open_file,
            commands::fs::save_file,
            commands::fs::write_text_file,
            commands::fs::read_text_file,
            commands::fs::read_dir_tree,
            commands::fs::create_file,
            commands::fs::create_folder,
            commands::fs::rename_path,
            commands::fs::delete_path,
            commands::fs::copy_image,
            commands::fs::move_image,
            commands::fs::delete_file,
            commands::fs::path_exists,
            commands::fs::save_image,
            commands::fs::import_image,
            commands::search::search_workspace,
            watcher::watch_workspace,
            watcher::unwatch_workspace,
            take_pending_files,
            set_recent_files,
            new_window,
            focus_all_windows,
            commands::platform::copy_text,
            commands::platform::read_clipboard,
            commands::platform::reveal_path,
            commands::platform::open_url,
        ])
        .setup(|app| {
            let handle = app.handle();
            let menu = menu::build_menu(handle, &[])?;
            if std::env::var_os("RYPORA_DUMP_MENU").is_some() {
                menu::dump(&menu);
            }
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let id = event.id().0.clone();
                // With several windows open, a menu command belongs to the
                // window the user is looking at.
                match focused_window(app) {
                    Some(window) => {
                        let _ = window.emit("menu://action", id);
                    }
                    None => {
                        let _ = app.emit("menu://action", id);
                    }
                }
            });

            // Command line arguments (Windows / Linux, or `rypora note.md`).
            let args: Vec<String> = std::env::args()
                .skip(1)
                .filter(|arg| !arg.starts_with('-'))
                .filter(|arg| is_openable(std::path::Path::new(arg)))
                .collect();
            if !args.is_empty() {
                queue_pending(handle, "main", &args);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = urls_to_paths(urls);
            if paths.is_empty() {
                return;
            }
            let target = focused_window(handle);
            if let Some(window) = &target {
                queue_pending(handle, window.label(), &paths);
                let _ = window.emit("app://open-files", paths);
            } else {
                queue_pending(handle, "main", &paths);
                let _ = handle.emit("app://open-files", paths);
            }
        }
    });
}
