use tauri::menu::{Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
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
        .item(&item(app, "about", "关于 Rypora", None)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("服务"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("隐藏 Rypora"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("全部显示"))?)
        .separator()
        .item(&item(app, "quit", "退出 Rypora", Some("CmdOrCtrl+Q"))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "文件")
        .item(&item(app, "new-file", "新建文件", Some("CmdOrCtrl+N"))?)
        .item(&item(app, "open-file", "打开文件…", Some("CmdOrCtrl+O"))?)
        .item(&item(
            app,
            "open-folder",
            "打开文件夹…",
            Some("CmdOrCtrl+Shift+O"),
        )?)
        .separator()
        .item(&item(app, "save", "保存", Some("CmdOrCtrl+S"))?)
        .item(&item(
            app,
            "save-as",
            "另存为…",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&item(app, "export-html", "导出为 HTML…", None)?)
        .item(&item(app, "export-pdf", "导出为 PDF…", None)?)
        .separator()
        .item(&item(app, "close-tab", "关闭标签页", Some("CmdOrCtrl+W"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .item(&item(app, "undo", "撤销", Some("CmdOrCtrl+Z"))?)
        .item(&item(app, "redo", "重做", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("剪切"))?)
        .item(&PredefinedMenuItem::copy(app, Some("复制"))?)
        .item(&PredefinedMenuItem::paste(app, Some("粘贴"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("全选"))?)
        .separator()
        .item(&item(app, "find", "查找…", Some("CmdOrCtrl+F"))?)
        .item(&item(
            app,
            "replace",
            "查找与替换…",
            Some("CmdOrCtrl+Alt+F"),
        )?)
        .separator()
        .item(&item(
            app,
            "preferences",
            "设置…",
            Some("CmdOrCtrl+,"),
        )?)
        .build()?;

    let format_menu = SubmenuBuilder::new(app, "格式")
        .item(&item(app, "bold", "粗体", Some("CmdOrCtrl+B"))?)
        .item(&item(app, "italic", "斜体", Some("CmdOrCtrl+I"))?)
        .item(&item(
            app,
            "strikethrough",
            "删除线",
            Some("CmdOrCtrl+Shift+X"),
        )?)
        .item(&item(
            app,
            "inline-code",
            "行内代码",
            Some("CmdOrCtrl+E"),
        )?)
        .item(&item(app, "link", "链接…", Some("CmdOrCtrl+K"))?)
        .separator()
        .item(&item(app, "heading-1", "标题 1", Some("CmdOrCtrl+1"))?)
        .item(&item(app, "heading-2", "标题 2", Some("CmdOrCtrl+2"))?)
        .item(&item(app, "heading-3", "标题 3", Some("CmdOrCtrl+3"))?)
        .item(&item(app, "heading-4", "标题 4", Some("CmdOrCtrl+4"))?)
        .item(&item(app, "heading-5", "标题 5", Some("CmdOrCtrl+5"))?)
        .item(&item(app, "heading-6", "标题 6", Some("CmdOrCtrl+6"))?)
        .item(&item(app, "paragraph", "正文", Some("CmdOrCtrl+0"))?)
        .separator()
        .item(&item(
            app,
            "quote",
            "引用",
            Some("CmdOrCtrl+Shift+Q"),
        )?)
        .item(&item(
            app,
            "code-block",
            "代码块",
            Some("CmdOrCtrl+Shift+K"),
        )?)
        .item(&item(
            app,
            "bullet-list",
            "无序列表",
            Some("CmdOrCtrl+Shift+8"),
        )?)
        .item(&item(
            app,
            "ordered-list",
            "有序列表",
            Some("CmdOrCtrl+Shift+7"),
        )?)
        .item(&item(
            app,
            "task-list",
            "任务列表",
            Some("CmdOrCtrl+Shift+9"),
        )?)
        .separator()
        .item(&item(app, "table", "表格", Some("CmdOrCtrl+T"))?)
        .item(&item(app, "image", "图片…", Some("CmdOrCtrl+Shift+I"))?)
        .item(&item(app, "horizontal-rule", "分割线", None)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "视图")
        .item(&item(
            app,
            "toggle-sidebar",
            "切换侧边栏",
            Some("CmdOrCtrl+Shift+L"),
        )?)
        .separator()
        .item(&item(app, "panel-files", "文件面板", None)?)
        .item(&item(app, "panel-outline", "大纲面板", None)?)
        .item(&item(app, "panel-search", "搜索面板", None)?)
        .separator()
        .item(&item(
            app,
            "toggle-theme",
            "切换深色模式",
            Some("CmdOrCtrl+Shift+D"),
        )?)
        .item(&item(
            app,
            "focus-mode",
            "专注模式",
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .item(&item(
            app,
            "typewriter-mode",
            "打字机模式",
            Some("CmdOrCtrl+Shift+T"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "窗口")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("缩放"))?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "帮助")
        .item(&item(app, "shortcuts", "键盘快捷键", None)?)
        .item(&item(app, "about", "关于 Rypora", None)?)
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
