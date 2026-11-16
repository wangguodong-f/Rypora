//! Thin wrappers over the platform clipboard and file browser.
//!
//! The clipboard is used by the "copy as …“ / "paste as plain text" menu
//! commands. Going through the platform utilities keeps the app free of an
//! extra clipboard plugin while still working without a user gesture, which a
//! native menu click does not provide to the web view.

use std::io::Write;
use std::process::{Command, Stdio};

#[tauri::command]
pub fn copy_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?;
        child
            .stdin
            .as_mut()
            .ok_or_else(|| "pbcopy stdin unavailable".to_string())?
            .write_all(text.as_bytes())
            .map_err(|error| error.to_string())?;
        child.wait().map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("clipboard is not supported on this platform yet".into())
    }
}

#[tauri::command]
pub fn read_clipboard() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("pbpaste")
            .output()
            .map_err(|error| error.to_string())?;
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("clipboard is not supported on this platform yet".into())
    }
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{path}"))
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .ok_or_else(|| "path has no parent directory".to_string())?;
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:"))
    {
        return Err("only http(s) and mailto links can be opened".into());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}
