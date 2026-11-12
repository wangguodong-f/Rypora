use tauri::menu::{Menu, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

fn item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
    let mut builder = MenuItemBuilder::with_id(id, label);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "Rypora")
        .item(&item(app, "about", "About Rypora", None)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&item(app, "quit", "Quit Rypora", Some("CmdOrCtrl+Q"))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new-file", "New File", Some("CmdOrCtrl+N"))?)
        .item(&item(app, "open-file", "Open File…", Some("CmdOrCtrl+O"))?)
        .item(
            &item(
                app,
                "open-folder",
                "Open Folder…",
                Some("CmdOrCtrl+Shift+O"),
            )?,
        )
        .separator()
        .item(&item(app, "save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item(
            app,
            "save-as",
            "Save As…",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&item(app, "export-html", "Export as HTML…", None)?)
        .item(&item(app, "export-pdf", "Export as PDF…", None)?)
        .separator()
        .item(&item(app, "close-tab", "Close Tab", Some("CmdOrCtrl+W"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&item(app, "undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item(app, "redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item(app, "find", "Find…", Some("CmdOrCtrl+F"))?)
        .item(&item(
            app,
            "replace",
            "Find and Replace…",
            Some("CmdOrCtrl+Alt+F"),
        )?)
        .separator()
        .item(&item(
            app,
            "preferences",
            "Preferences…",
            Some("CmdOrCtrl+,"),
        )?)
        .build()?;

    let format_menu = SubmenuBuilder::new(app, "Format")
        .item(&item(app, "bold", "Bold", Some("CmdOrCtrl+B"))?)
        .item(&item(app, "italic", "Italic", Some("CmdOrCtrl+I"))?)
        .item(&item(
            app,
            "strikethrough",
            "Strikethrough",
            Some("CmdOrCtrl+Shift+X"),
        )?)
        .item(&item(
            app,
            "inline-code",
            "Inline Code",
            Some("CmdOrCtrl+E"),
        )?)
        .item(&item(app, "link", "Link…", Some("CmdOrCtrl+K"))?)
        .separator()
        .item(&item(app, "heading-1", "Heading 1", Some("CmdOrCtrl+1"))?)
        .item(&item(app, "heading-2", "Heading 2", Some("CmdOrCtrl+2"))?)
        .item(&item(app, "heading-3", "Heading 3", Some("CmdOrCtrl+3"))?)
        .item(&item(app, "heading-4", "Heading 4", Some("CmdOrCtrl+4"))?)
        .item(&item(app, "heading-5", "Heading 5", Some("CmdOrCtrl+5"))?)
        .item(&item(app, "heading-6", "Heading 6", Some("CmdOrCtrl+6"))?)
        .item(&item(app, "paragraph", "Paragraph", Some("CmdOrCtrl+0"))?)
        .separator()
        .item(&item(
            app,
            "quote",
            "Blockquote",
            Some("CmdOrCtrl+Shift+Q"),
        )?)
        .item(&item(
            app,
            "code-block",
            "Code Block",
            Some("CmdOrCtrl+Shift+K"),
        )?)
        .item(&item(
            app,
            "bullet-list",
            "Bullet List",
            Some("CmdOrCtrl+Shift+8"),
        )?)
        .item(&item(
            app,
            "ordered-list",
            "Ordered List",
            Some("CmdOrCtrl+Shift+7"),
        )?)
        .item(&item(
            app,
            "task-list",
            "Task List",
            Some("CmdOrCtrl+Shift+9"),
        )?)
        .separator()
        .item(&item(app, "table", "Table", Some("CmdOrCtrl+T"))?)
        .item(&item(app, "image", "Image…", Some("CmdOrCtrl+Shift+I"))?)
        .item(&item(app, "horizontal-rule", "Horizontal Rule", None)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&item(
            app,
            "toggle-sidebar",
            "Toggle Sidebar",
            Some("CmdOrCtrl+Shift+L"),
        )?)
        .separator()
        .item(&item(app, "panel-files", "Files Panel", None)?)
        .item(&item(app, "panel-outline", "Outline Panel", None)?)
        .item(&item(app, "panel-search", "Search Panel", None)?)
        .separator()
        .item(&item(
            app,
            "toggle-theme",
            "Toggle Dark Mode",
            Some("CmdOrCtrl+Shift+D"),
        )?)
        .item(&item(
            app,
            "focus-mode",
            "Focus Mode",
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .item(&item(
            app,
            "typewriter-mode",
            "Typewriter Mode",
            Some("CmdOrCtrl+Shift+T"),
        )?)
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&item(app, "shortcuts", "Keyboard Shortcuts", None)?)
        .item(&item(app, "about", "About Rypora", None)?)
        .build()?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &format_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}
