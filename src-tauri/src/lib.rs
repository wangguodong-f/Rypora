mod commands;
mod error;
mod menu;
mod watcher;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use watcher::WatcherState;

/// Files handed to the app before the frontend was ready (macOS `open`,
/// Finder double-click, or a command line argument).
#[derive(Default)]
struct PendingOpen(Mutex<Vec<String>>);

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

/// Frontend drains this once on mount, then relies on `app://open-files`.
#[tauri::command]
fn take_pending_files(state: tauri::State<'_, PendingOpen>) -> Vec<String> {
    let mut pending = state.0.lock().expect("pending open lock poisoned");
    std::mem::take(&mut *pending)
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(WatcherState::default())
        .manage(PendingOpen::default())
        .invoke_handler(tauri::generate_handler![
            commands::fs::open_file,
            commands::fs::save_file,
            commands::fs::write_text_file,
            commands::fs::read_dir_tree,
            commands::fs::create_file,
            commands::fs::create_folder,
            commands::fs::rename_path,
            commands::fs::delete_path,
            commands::fs::path_exists,
            commands::fs::save_image,
            commands::fs::import_image,
            commands::search::search_workspace,
            watcher::watch_workspace,
            watcher::unwatch_workspace,
            take_pending_files,
        ])
        .setup(|app| {
            let handle = app.handle();
            let menu = menu::build_menu(handle)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu://action", event.id().0.clone());
            });

            // Command line arguments (Windows / Linux, or `rypora note.md`).
            let args: Vec<String> = std::env::args()
                .skip(1)
                .filter(|arg| !arg.starts_with('-'))
                .filter(|arg| is_openable(std::path::Path::new(arg)))
                .collect();
            if !args.is_empty() {
                let pending = app.state::<PendingOpen>();
                pending
                    .0
                    .lock()
                    .expect("pending open lock poisoned")
                    .extend(args);
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
            {
                let pending = handle.state::<PendingOpen>();
                pending
                    .0
                    .lock()
                    .expect("pending open lock poisoned")
                    .extend(paths.iter().cloned());
            }
            let _ = handle.emit("app://open-files", paths);
        }
    });
}
