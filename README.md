# Rypora

一个使用 Rust + Tauri v2 构建的、类似 Typora 的所见即所得 Markdown 桌面编辑器。

## 技术栈

- **桌面外壳**：Tauri v2（Rust）
- **前端**：React 19 + TypeScript + Vite
- **编辑器内核**：Milkdown 7（ProseMirror）
- **高级渲染**：KaTeX、Mermaid、Prism（refractor）

## 功能

- 所见即所得编辑，支持标题、粗体/斜体/删除线、引用、列表、任务列表、表格、代码块、分割线
- 行内与块级数学公式（KaTeX）
- Mermaid 图表实时预览
- 代码块语法高亮（Rust、TS/JS、Python、Go、Java、C/C++、SQL、JSON、YAML、Bash 等）
- 多标签页、文件树、大纲、工作区搜索、查找替换
- 图片粘贴/拖入，按相对路径保存并显示；支持远程、绝对路径与 `file://` 图片
- 可从访达双击、`open -a Rypora 文档.md` 或命令行参数直接打开文档
- 主题（浅色/深色/跟随系统）、专注模式、打字机模式、设置持久化
- 自动保存、外部修改检测与冲突提示（mtime + blake3）
- 关闭标签页或窗口前提示“保存 / 不保存 / 取消”，避免误丢改动
- 导出 HTML、通过系统打印导出 PDF
- 文件操作走系统废纸篓，原子写入

## 开发

```bash
npm install
npm run tauri dev
```

仅调试前端（浏览器）：

```bash
npm run dev
# http://localhost:1420/?demo=1
```

## 构建

```bash
npm run tauri build
```

产物位于 `target/release/bundle/`（`.app` 与 `.dmg`）。DMG 打包会调用 Finder
自动排版窗口，在无图形会话或未授予自动化权限的环境里可能长时间无响应；
此时只构建应用包：

```bash
npm run tauri build -- --bundles app
```

## 常用快捷键

| 操作 | 快捷键 |
| --- | --- |
| 新建文件 | ⌘N |
| 打开文件 | ⌘O |
| 保存 | ⌘S |
| 另存为 | ⌘⇧S |
| 关闭标签 | ⌘W |
| 查找 / 替换 | ⌘F |
| 切换侧边栏 | ⌘⇧L |
| 专注模式 | ⌘⇧F |
| 切换深色模式 | ⌘⇧D |
| 设置 | ⌘, |

## 目录结构

```
src/                 React 前端
  components/        UI 组件
  editor/            Milkdown 编辑器与自定义插件
  lib/               IPC、文件操作、导出
  stores/            Zustand 状态
  styles/            全局样式与打印样式
src-tauri/           Tauri / Rust 后端
  src/commands/      文件系统与搜索命令
  src/menu.rs        原生菜单
  src/watcher.rs     文件变更监听
```

## 开发自测

`src/lib/selftest.ts` 会在开发模式下通过真实 IPC 验证文件读写、冲突检测、目录树、搜索与重命名：

```bash
npm run selftest
```

报告写入系统临时目录下的 `rypora-selftest-*/report.json`。
