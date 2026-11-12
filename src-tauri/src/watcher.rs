use crate::error::{AppError, AppResult};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime, State};

#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn watch_workspace<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, WatcherState>,
    root: String,
) -> AppResult<()> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| AppError::Other("watcher lock poisoned".into()))?;
    // Drop the previous watcher before installing the new one.
    *guard = None;

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else {
            return;
        };
        use notify::EventKind::*;
        if matches!(event.kind, Create(_) | Modify(_) | Remove(_) | Access(_)) {
            let paths: Vec<String> = event
                .paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !paths.is_empty() {
                let _ = app_handle.emit("fs://changed", paths);
            }
        }
    })
    .map_err(|e| AppError::Other(e.to_string()))?;

    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| AppError::Other(e.to_string()))?;

    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_workspace(state: State<'_, WatcherState>) -> AppResult<()> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| AppError::Other("watcher lock poisoned".into()))?;
    *guard = None;
    Ok(())
}
