use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

/// An available menu item.
fn it<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(app, id, label, true, accelerator)
}

/// A menu item whose behaviour is not implemented yet. It stays visible so the
/// menu structure matches Typora, and is greyed out so it cannot be triggered.
fn dim<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(app, id, label, false, accelerator)
}

/// Short label for a recent file: `note.md — ~/Documents`.
fn recent_label(path: &str) -> String {
    let file = std::path::Path::new(path);
    let name = file
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path);
    match file.parent().and_then(|p| p.to_str()) {
        Some(dir) if !dir.is_empty() => {
            let home = std::env::var("HOME").ok();
            let dir = match home {
                Some(home) if dir.starts_with(&home) => {
                    format!("~{}", &dir[home.len()..])
                }
                _ => dir.to_string(),
            };
            format!("{name} — {dir}")
        }
        _ => name.to_string(),
    }
}

fn recent_menu<R: Runtime>(
    app: &AppHandle<R>,
    recent: &[String],
) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, "打开最近文件");
    for (index, path) in recent.iter().take(12).enumerate() {
        let item = MenuItem::with_id(
            app,
            format!("file.recent.open.{index}"),
            recent_label(path),
            true,
            None::<&str>,
        )?;
        builder = builder.item(&item);
    }
    if !recent.is_empty() {
        builder = builder.separator();
    }
    builder = builder.item(&it(
        app,
        "file.recent.reopen",
        "重新打开关闭的文件",
        Some("CmdOrCtrl+Shift+T"),
    )?);
    builder = builder.separator();
    builder = builder.item(&if recent.is_empty() {
        dim(app, "file.recent.clear", "清除最近文件", None)?
    } else {
        it(app, "file.recent.clear", "清除最近文件", None)?
    });
    builder.build()
}

fn file_menu<R: Runtime>(
    app: &AppHandle<R>,
    recent_files: &[String],
) -> tauri::Result<Submenu<R>> {
    let recent = recent_menu(app, recent_files)?;

    let export = SubmenuBuilder::new(app, "导出")
        .item(&it(app, "file.export.html", "HTML…", None)?)
        .item(&it(app, "file.export.pdf", "PDF…", None)?)
        .separator()
        .item(&dim(app, "file.export.word", "Word (.docx)…", None)?)
        .item(&dim(app, "file.export.latex", "LaTeX…", None)?)
        .item(&dim(app, "file.export.epub", "ePub…", None)?)
        .item(&dim(app, "file.export.image", "图片 (PNG)…", None)?)
        .build()?;

    SubmenuBuilder::new(app, "文件")
        .item(&it(app, "file.new", "新建", Some("CmdOrCtrl+N"))?)
        .item(&it(
            app,
            "file.new-tab",
            "新建标签页",
            Some("CmdOrCtrl+T"),
        )?)
        .item(&it(
            app,
            "file.new-window",
            "新建窗口",
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .separator()
        .item(&it(app, "file.open", "打开…", Some("CmdOrCtrl+O"))?)
        .item(&it(app, "file.open-folder", "打开文件夹…", None)?)
        .item(&recent)
        .item(&it(
            app,
            "file.quick-open",
            "快速打开…",
            Some("CmdOrCtrl+Shift+O"),
        )?)
        .separator()
        .item(&it(app, "file.info", "显示简介…", None)?)
        .item(&dim(app, "file.reveal-library", "在文档列表中显示", None)?)
        .item(&it(app, "file.reveal-tree", "在文件树中显示", None)?)
        .item(&it(app, "file.reveal-finder", "打开文件位置", None)?)
        .separator()
        .item(&it(app, "file.delete", "删除…", None)?)
        .separator()
        .item(&it(app, "file.close", "关闭", Some("CmdOrCtrl+W"))?)
        .separator()
        .item(&it(app, "file.save", "保存", Some("CmdOrCtrl+S"))?)
        .item(&it(
            app,
            "file.save-as",
            "另存为…",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .item(&it(app, "file.revert", "恢复", None)?)
        .item(&it(
            app,
            "file.save-all",
            "保存全部打开的文件",
            Some("CmdOrCtrl+Alt+S"),
        )?)
        .separator()
        .item(&it(app, "file.import", "导入…", None)?)
        .item(&export)
        .separator()
        .item(&dim(
            app,
            "file.page-setup",
            "页面设置…",
            Some("CmdOrCtrl+Shift+P"),
        )?)
        .item(&it(app, "file.print", "打印…", Some("CmdOrCtrl+P"))?)
        .build()
}

fn edit_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let selection = SubmenuBuilder::new(app, "选择")
        .item(&it(app, "edit.select.all", "全选", Some("CmdOrCtrl+A"))?)
        .item(&it(
            app,
            "edit.select.block",
            "选择段落或块",
            Some("CmdOrCtrl+Alt+P"),
        )?)
        .item(&it(
            app,
            "edit.select.line",
            "选中当前行或句",
            Some("CmdOrCtrl+L"),
        )?)
        .item(&it(
            app,
            "edit.select.scope",
            "选中当前格式文本",
            Some("CmdOrCtrl+E"),
        )?)
        .item(&it(
            app,
            "edit.select.word",
            "选中当前词",
            Some("CmdOrCtrl+D"),
        )?)
        .separator()
        .item(&it(
            app,
            "edit.select.jump-top",
            "跳转到文首",
            Some("CmdOrCtrl+ArrowUp"),
        )?)
        .item(&it(
            app,
            "edit.select.jump-selection",
            "跳转到所选内容",
            Some("CmdOrCtrl+J"),
        )?)
        .item(&it(
            app,
            "edit.select.jump-bottom",
            "跳转到文末",
            Some("CmdOrCtrl+ArrowDown"),
        )?)
        .separator()
        .item(&it(
            app,
            "edit.select.jump-line-start",
            "跳转到行首",
            Some("Control+A"),
        )?)
        .item(&it(
            app,
            "edit.select.jump-line-end",
            "跳转到行尾",
            Some("Control+E"),
        )?)
        .build()?;

    let delete_range = SubmenuBuilder::new(app, "删除范围")
        .item(&it(
            app,
            "edit.delete.block",
            "删除块",
            Some("CmdOrCtrl+Alt+Shift+P"),
        )?)
        .item(&it(
            app,
            "edit.delete.line",
            "删除当前行或句",
            Some("CmdOrCtrl+Alt+Shift+L"),
        )?)
        .item(&it(
            app,
            "edit.delete.scope",
            "删除当前格式文本",
            Some("CmdOrCtrl+Alt+Shift+E"),
        )?)
        .item(&it(
            app,
            "edit.delete.word",
            "删除当前词",
            Some("CmdOrCtrl+Shift+D"),
        )?)
        .build()?;

    let math_tools = SubmenuBuilder::new(app, "数学工具")
        .item(&it(
            app,
            "edit.math.refresh",
            "刷新所有数学公式",
            None,
        )?)
        .build()?;

    let line_endings = SubmenuBuilder::new(app, "换行符")
        .item(&dim(
            app,
            "edit.eol.crlf",
            "Windows 换行符 (CRLF)",
            None,
        )?)
        .item(&dim(
            app,
            "edit.eol.lf",
            "Unix 换行符 (LF)",
            None,
        )?)
        .separator()
        .item(&dim(
            app,
            "edit.eol.final-newline",
            "保存时在文末添加空行",
            None,
        )?)
        .build()?;

    let whitespace = SubmenuBuilder::new(app, "空格与换行")
        .item(&dim(
            app,
            "edit.space.indent-first-line",
            "首行缩进",
            None,
        )?)
        .separator()
        .item(&dim(app, "edit.space.visible-br", "显示 <br/>", None)?)
        .item(&dim(
            app,
            "edit.space.preserve-break",
            "保留单换行符",
            None,
        )?)
        .separator()
        .item(&dim(app, "edit.space.learn-more", "了解更多", None)?)
        .build()?;

    let substitutions = SubmenuBuilder::new(app, "替换")
        .item(&dim(
            app,
            "edit.sub.convert-input",
            "输入时转换",
            None,
        )?)
        .item(&dim(
            app,
            "edit.sub.convert-rendering",
            "渲染时转换",
            None,
        )?)
        .separator()
        .item(&dim(app, "edit.sub.smart-quotes", "智能引号", None)?)
        .item(&dim(app, "edit.sub.smart-dashes", "智能折号", None)?)
        .item(&dim(app, "edit.sub.text-replacement", "文本替换", None)?)
        .separator()
        .item(&dim(
            app,
            "edit.sub.remap-punctuation",
            "解析 Markdown 时允许并转化 Unicode 标点",
            None,
        )?)
        .separator()
        .item(&dim(app, "edit.sub.more", "更多选项…", None)?)
        .build()?;

    let spelling = SubmenuBuilder::new(app, "拼写和语法检查")
        .item(&dim(
            app,
            "edit.spell.panel",
            "显示拼写和语法",
            Some("CmdOrCtrl+:"),
        )?)
        .item(&dim(
            app,
            "edit.spell.check-now",
            "立即检查文稿",
            Some("CmdOrCtrl+;"),
        )?)
        .separator()
        .item(&dim(
            app,
            "edit.spell.while-typing",
            "键入时检查拼写",
            None,
        )?)
        .item(&dim(
            app,
            "edit.spell.grammar",
            "检查拼写和语法",
            None,
        )?)
        .item(&dim(
            app,
            "edit.spell.auto-correct",
            "自动纠正拼写",
            None,
        )?)
        .build()?;

    let find = SubmenuBuilder::new(app, "查找")
        .item(&it(app, "edit.find.find", "查找…", Some("CmdOrCtrl+F"))?)
        .item(&it(
            app,
            "edit.find.next",
            "查找下一个",
            Some("CmdOrCtrl+G"),
        )?)
        .item(&it(
            app,
            "edit.find.previous",
            "查找上一个",
            Some("CmdOrCtrl+Shift+G"),
        )?)
        .separator()
        .item(&it(
            app,
            "edit.find.replace",
            "查找和替换…",
            Some("CmdOrCtrl+Alt+F"),
        )?)
        .item(&it(
            app,
            "edit.find.replace-next",
            "替换下一个",
            Some("CmdOrCtrl+Alt+E"),
        )?)
        .separator()
        .item(&it(
            app,
            "edit.find.jump-selection",
            "跳转到所选内容",
            None,
        )?)
        .build()?;

    let speech = SubmenuBuilder::new(app, "语音")
        .item(&dim(app, "edit.speech.start", "开始朗读", None)?)
        .item(&dim(app, "edit.speech.stop", "结束朗读", None)?)
        .build()?;

    SubmenuBuilder::new(app, "编辑")
        .item(&it(app, "edit.undo", "撤消", Some("CmdOrCtrl+Z"))?)
        .item(&it(app, "edit.redo", "重做", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("剪切"))?)
        .item(&PredefinedMenuItem::copy(app, Some("复制"))?)
        .item(&PredefinedMenuItem::paste(app, Some("粘贴"))?)
        .separator()
        .item(&it(app, "edit.copy.plain", "复制为纯文本", None)?)
        .item(&it(
            app,
            "edit.copy.markdown",
            "复制为 Markdown",
            Some("CmdOrCtrl+Shift+C"),
        )?)
        .item(&it(app, "edit.copy.html", "复制为 HTML 代码", None)?)
        .item(&it(
            app,
            "edit.copy.simplified",
            "复制内容并简化格式",
            None,
        )?)
        .separator()
        .item(&it(
            app,
            "edit.paste.plain",
            "粘贴为纯文本",
            Some("CmdOrCtrl+Shift+V"),
        )?)
        .item(&it(
            app,
            "edit.paste.match-style",
            "粘贴并匹配样式",
            Some("CmdOrCtrl+Alt+Shift+V"),
        )?)
        .separator()
        .item(&selection)
        .item(&it(
            app,
            "edit.move-row-up",
            "上移该行",
            Some("Alt+ArrowUp"),
        )?)
        .item(&it(
            app,
            "edit.move-row-down",
            "下移该行",
            Some("Alt+ArrowDown"),
        )?)
        .separator()
        .item(&it(app, "edit.delete", "删除", None)?)
        .item(&delete_range)
        .separator()
        .item(&math_tools)
        .item(&line_endings)
        .item(&whitespace)
        .item(&substitutions)
        .item(&spelling)
        .separator()
        .item(&find)
        .item(&speech)
        .build()
}

fn paragraph_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let table = SubmenuBuilder::new(app, "表格")
        .item(&it(app, "para.table.insert", "插入表格", Some("CmdOrCtrl+Alt+T"))?)
        .separator()
        .item(&it(app, "para.table.row-above", "上方插入行", None)?)
        .item(&it(
            app,
            "para.table.row-below",
            "下方插入行",
            Some("CmdOrCtrl+Enter"),
        )?)
        .separator()
        .item(&it(app, "para.table.col-before", "左侧插入列", None)?)
        .item(&it(app, "para.table.col-after", "右侧插入列", None)?)
        .separator()
        .item(&it(
            app,
            "para.table.row-up",
            "向上移动表格行",
            Some("Control+CmdOrCtrl+ArrowUp"),
        )?)
        .item(&it(
            app,
            "para.table.row-down",
            "向下移动表格行",
            Some("Control+CmdOrCtrl+ArrowDown"),
        )?)
        .item(&it(
            app,
            "para.table.col-left",
            "向左移动表格列",
            Some("Control+CmdOrCtrl+ArrowLeft"),
        )?)
        .item(&it(
            app,
            "para.table.col-right",
            "向右移动表格列",
            Some("Control+CmdOrCtrl+ArrowRight"),
        )?)
        .separator()
        .item(&it(
            app,
            "para.table.delete-row",
            "删除行",
            Some("CmdOrCtrl+Shift+Backspace"),
        )?)
        .item(&it(app, "para.table.delete-column", "删除列", None)?)
        .separator()
        .item(&it(app, "para.table.copy", "复制表格", None)?)
        .item(&dim(app, "para.table.prettify", "格式化表格源码", None)?)
        .separator()
        .item(&it(app, "para.table.delete", "删除表格", None)?)
        .build()?;

    let code_tools = SubmenuBuilder::new(app, "代码工具")
        .item(&it(app, "para.code.copy", "复制代码块内容", None)?)
        .item(&dim(
            app,
            "para.code.indent-selection",
            "为选中内容调整缩进",
            None,
        )?)
        .item(&dim(
            app,
            "para.code.indent-all",
            "为整个代码块调整缩进",
            None,
        )?)
        .build()?;

    let alert = SubmenuBuilder::new(app, "警告框")
        .item(&it(app, "para.alert.note", "提醒内容", None)?)
        .item(&it(app, "para.alert.tip", "建议内容", None)?)
        .item(&it(app, "para.alert.important", "重要内容", None)?)
        .item(&it(app, "para.alert.warning", "警告内容", None)?)
        .item(&it(app, "para.alert.caution", "注意内容", None)?)
        .build()?;

    let task_status = SubmenuBuilder::new(app, "任务状态")
        .item(&it(
            app,
            "para.task.toggle",
            "切换任务状态",
            Some("Control+X"),
        )?)
        .separator()
        .item(&it(app, "para.task.complete", "标记为已完成", None)?)
        .item(&it(app, "para.task.incomplete", "标记为未完成", None)?)
        .build()?;

    let list_indent = SubmenuBuilder::new(app, "列表缩进")
        .item(&it(
            app,
            "para.list.indent",
            "增加缩进",
            Some("CmdOrCtrl+]"),
        )?)
        .item(&it(
            app,
            "para.list.outdent",
            "减少缩进",
            Some("CmdOrCtrl+["),
        )?)
        .build()?;

    SubmenuBuilder::new(app, "段落")
        .item(&it(app, "para.heading.1", "一级标题", Some("CmdOrCtrl+1"))?)
        .item(&it(app, "para.heading.2", "二级标题", Some("CmdOrCtrl+2"))?)
        .item(&it(app, "para.heading.3", "三级标题", Some("CmdOrCtrl+3"))?)
        .item(&it(app, "para.heading.4", "四级标题", Some("CmdOrCtrl+4"))?)
        .item(&it(app, "para.heading.5", "五级标题", Some("CmdOrCtrl+5"))?)
        .item(&it(app, "para.heading.6", "六级标题", Some("CmdOrCtrl+6"))?)
        .separator()
        .item(&it(app, "para.paragraph", "段落", Some("CmdOrCtrl+0"))?)
        .separator()
        .item(&it(
            app,
            "para.heading.increase",
            "提升标题级别",
            Some("CmdOrCtrl+="),
        )?)
        .item(&it(
            app,
            "para.heading.decrease",
            "降低标题级别",
            Some("CmdOrCtrl+-"),
        )?)
        .separator()
        .item(&table)
        .item(&it(
            app,
            "para.math-block",
            "公式块",
            Some("CmdOrCtrl+Alt+B"),
        )?)
        .item(&it(
            app,
            "para.code-block",
            "代码块",
            Some("CmdOrCtrl+Alt+C"),
        )?)
        .item(&code_tools)
        .item(&alert)
        .separator()
        .item(&it(app, "para.quote", "引用", Some("CmdOrCtrl+Alt+Q"))?)
        .separator()
        .item(&it(
            app,
            "para.list.ordered",
            "有序列表",
            Some("CmdOrCtrl+Alt+O"),
        )?)
        .item(&it(
            app,
            "para.list.unordered",
            "无序列表",
            Some("CmdOrCtrl+Alt+U"),
        )?)
        .item(&it(
            app,
            "para.list.task",
            "任务列表",
            Some("CmdOrCtrl+Alt+X"),
        )?)
        .item(&task_status)
        .item(&list_indent)
        .separator()
        .item(&it(
            app,
            "para.insert-before",
            "在上方插入段落",
            None,
        )?)
        .item(&it(app, "para.insert-after", "在下方插入段落", None)?)
        .separator()
        .item(&it(
            app,
            "para.link-reference",
            "链接引用",
            Some("CmdOrCtrl+Alt+L"),
        )?)
        .item(&it(
            app,
            "para.footnote",
            "脚注",
            Some("CmdOrCtrl+Alt+R"),
        )?)
        .separator()
        .item(&it(
            app,
            "para.hr",
            "水平分割线",
            Some("CmdOrCtrl+Alt+-"),
        )?)
        .item(&dim(app, "para.toc", "内容目录", None)?)
        .item(&dim(app, "para.yaml", "YAML Front Matter", None)?)
        .build()
}

fn format_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let link_actions = SubmenuBuilder::new(app, "链接操作")
        .item(&it(app, "fmt.link.open", "打开链接", None)?)
        .item(&it(app, "fmt.link.copy", "复制链接地址", None)?)
        .build()?;

    let zoom = SubmenuBuilder::new(app, "缩放图片")
        .item(&it(app, "fmt.image.zoom.25", "25%", None)?)
        .item(&it(app, "fmt.image.zoom.33", "33%", None)?)
        .item(&it(app, "fmt.image.zoom.50", "50%", None)?)
        .item(&it(app, "fmt.image.zoom.67", "67%", None)?)
        .item(&it(app, "fmt.image.zoom.80", "80%", None)?)
        .separator()
        .item(&it(app, "fmt.image.zoom.100", "100%", None)?)
        .separator()
        .item(&it(app, "fmt.image.zoom.150", "150%", None)?)
        .item(&it(app, "fmt.image.zoom.200", "200%", None)?)
        .build()?;

    let syntax = SubmenuBuilder::new(app, "转换图片语法")
        .item(&it(app, "fmt.image.syntax.markdown", "Markdown 语法", None)?)
        .item(&it(app, "fmt.image.syntax.html", "HTML 语法", None)?)
        .build()?;

    let insert_mode = SubmenuBuilder::new(app, "当插入本地图片时")
        .item(&dim(
            app,
            "fmt.image.copy-to-folder",
            "复制图片到文件夹",
            None,
        )?)
        .item(&dim(app, "fmt.image.upload-auto", "上传图片", None)?)
        .build()?;

    let image = SubmenuBuilder::new(app, "图像")
        .item(&it(
            app,
            "fmt.image.insert",
            "插入图片",
            Some("CmdOrCtrl+Control+I"),
        )?)
        .item(&it(
            app,
            "fmt.image.insert-local",
            "插入本地图片…",
            None,
        )?)
        .separator()
        .item(&it(app, "fmt.image.reveal", "打开图片位置", None)?)
        .item(&zoom)
        .item(&syntax)
        .separator()
        .item(&it(app, "fmt.image.delete-file", "删除图片文件", None)?)
        .separator()
        .item(&it(app, "fmt.image.copy-to", "复制图片到…", None)?)
        .item(&it(
            app,
            "fmt.image.rename",
            "重命名 / 移动图片到…",
            None,
        )?)
        .item(&dim(app, "fmt.image.upload", "上传图片", None)?)
        .separator()
        .item(&it(app, "fmt.image.copy-all", "复制所有图片到…", None)?)
        .item(&it(app, "fmt.image.move-all", "移动所有图片到…", None)?)
        .item(&dim(
            app,
            "fmt.image.upload-all",
            "上传所有本地图片",
            None,
        )?)
        .separator()
        .item(&it(app, "fmt.image.reload-all", "重新加载所有图片", None)?)
        .separator()
        .item(&insert_mode)
        .item(&it(app, "fmt.image.root-path", "设置图片根目录", None)?)
        .separator()
        .item(&it(
            app,
            "fmt.image.global-settings",
            "全局图像设置…",
            None,
        )?)
        .build()?;

    SubmenuBuilder::new(app, "格式")
        .item(&it(app, "fmt.strong", "加粗", Some("CmdOrCtrl+B"))?)
        .item(&it(app, "fmt.emphasis", "斜体", Some("CmdOrCtrl+I"))?)
        .item(&it(app, "fmt.underline", "下划线", Some("CmdOrCtrl+U"))?)
        .item(&it(app, "fmt.code", "代码", Some("Control+Backquote"))?)
        .separator()
        .item(&it(app, "fmt.math-inline", "内联公式", Some("Control+M"))?)
        .item(&it(
            app,
            "fmt.strike",
            "删除线",
            Some("Control+Shift+Backquote"),
        )?)
        .item(&it(app, "fmt.highlight", "高亮", Some("CmdOrCtrl+Shift+H"))?)
        .item(&it(app, "fmt.superscript", "上标", None)?)
        .item(&it(app, "fmt.subscript", "下标", None)?)
        .item(&it(app, "fmt.comment", "注释", Some("Control+-"))?)
        .separator()
        .item(&it(app, "fmt.hyperlink", "超链接", Some("CmdOrCtrl+K"))?)
        .item(&link_actions)
        .item(&image)
        .item(&dim(app, "fmt.take-picture", "拍照", None)?)
        .separator()
        .item(&it(
            app,
            "fmt.clear",
            "清除样式",
            Some("CmdOrCtrl+Backslash"),
        )?)
        .build()
}

fn view_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "显示")
        .item(&it(
            app,
            "view.source-mode",
            "源代码模式",
            Some("CmdOrCtrl+/"),
        )?)
        .separator()
        .item(&it(app, "view.focus-mode", "专注模式", Some("F8"))?)
        .item(&it(app, "view.typewriter-mode", "打字机模式", Some("F9"))?)
        .separator()
        .item(&it(
            app,
            "view.sidebar",
            "显示／隐藏侧边栏",
            Some("CmdOrCtrl+Shift+L"),
        )?)
        .item(&it(
            app,
            "view.panel.outline",
            "大纲",
            Some("Control+CmdOrCtrl+1"),
        )?)
        .item(&it(
            app,
            "view.panel.articles",
            "文档列表",
            Some("Control+CmdOrCtrl+2"),
        )?)
        .item(&it(
            app,
            "view.panel.files",
            "文件树",
            Some("Control+CmdOrCtrl+3"),
        )?)
        .item(&it(
            app,
            "view.panel.search",
            "搜索",
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .separator()
        .item(&it(app, "view.word-count", "字数统计窗口", None)?)
        .item(&it(app, "view.outline-popover", "大纲窗口", None)?)
        .separator()
        .item(&dim(app, "view.magnification", "双指缩放", None)?)
        .item(&it(
            app,
            "view.actual-size",
            "实际大小",
            Some("CmdOrCtrl+Shift+0"),
        )?)
        .item(&it(
            app,
            "view.zoom-in",
            "放大",
            Some("CmdOrCtrl+Shift+="),
        )?)
        .item(&it(
            app,
            "view.zoom-out",
            "缩小",
            Some("CmdOrCtrl+Shift+-"),
        )?)
        .separator()
        .item(&it(app, "view.always-on-top", "保持窗口在最前端", None)?)
        .item(&PredefinedMenuItem::fullscreen(app, Some("全屏"))?)
        .build()
}

fn theme_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "主题")
        .item(&it(app, "theme.auto", "自动", None)?)
        .item(&it(app, "theme.light", "浅色", None)?)
        .item(&it(app, "theme.dark", "深色", None)?)
        .separator()
        .item(&it(app, "theme.github", "Github", None)?)
        .item(&it(app, "theme.gothic", "Gothic", None)?)
        .item(&it(app, "theme.newsprint", "Newsprint", None)?)
        .item(&it(app, "theme.night", "Night", None)?)
        .item(&it(app, "theme.pixyll", "Pixyll", None)?)
        .item(&it(app, "theme.whitey", "Whitey", None)?)
        .build()
}

fn window_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "窗口")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("缩放"))?)
        .separator()
        .item(&it(
            app,
            "window.bring-all-to-front",
            "前置全部窗口",
            None,
        )?)
        .build()
}

fn help_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    SubmenuBuilder::new(app, "帮助")
        .item(&it(app, "help.shortcuts", "键盘快捷键", None)?)
        .item(&it(app, "help.about", "关于 Rypora", None)?)
        .build()
}

pub fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    recent_files: &[String],
) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "Rypora")
        .item(&it(app, "app.about", "关于 Rypora", None)?)
        .separator()
        .item(&it(app, "app.preferences", "设置…", Some("CmdOrCtrl+,"))?)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("服务"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("隐藏 Rypora"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("全部显示"))?)
        .separator()
        .item(&it(app, "app.quit", "退出 Rypora", Some("CmdOrCtrl+Q"))?)
        .build()?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu(app, recent_files)?,
            &edit_menu(app)?,
            &paragraph_menu(app)?,
            &format_menu(app)?,
            &view_menu(app)?,
            &theme_menu(app)?,
            &window_menu(app)?,
            &help_menu(app)?,
        ],
    )
}

/// Development helper: print the whole menu tree. Enabled with
/// `RYPORA_DUMP_MENU=1`, used to verify the menu against Typora.
pub fn dump<R: Runtime>(menu: &Menu<R>) {
    fn walk<R: Runtime>(kind: &tauri::menu::MenuItemKind<R>, depth: usize) {
        use tauri::menu::MenuItemKind;
        let pad = "  ".repeat(depth);
        match kind {
            MenuItemKind::Submenu(sub) => {
                println!("{pad}#{} {}", sub.id().0, sub.text().unwrap_or_default());
                if let Ok(items) = sub.items() {
                    for item in &items {
                        walk(item, depth + 1);
                    }
                }
            }
            MenuItemKind::MenuItem(item) => println!(
                "{pad}{} {}{}",
                item.id().0,
                item.text().unwrap_or_default(),
                if item.is_enabled().unwrap_or(true) {
                    ""
                } else {
                    "  [dim]"
                }
            ),
            MenuItemKind::Predefined(item) => {
                println!("{pad}{} <predefined>", item.id().0)
            }
            MenuItemKind::Check(item) => println!(
                "{pad}{} {}",
                item.id().0,
                item.text().unwrap_or_default()
            ),
            MenuItemKind::Icon(item) => println!(
                "{pad}{} {}",
                item.id().0,
                item.text().unwrap_or_default()
            ),
        }
    }

    if let Ok(items) = menu.items() {
        for item in &items {
            walk(item, 0);
        }
    }
}
