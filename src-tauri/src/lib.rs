mod commands;
mod error;
mod menu;
mod watcher;

use tauri::Emitter;
use watcher::WatcherState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(WatcherState::default())
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
        ])
        .setup(|app| {
            let handle = app.handle();
            let menu = menu::build_menu(handle)?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu://action", event.id().0.clone());
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
