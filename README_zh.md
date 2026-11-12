# Rypora

一个使用 **Rust + Tauri v2** 构建、类似 Typora 的所见即所得 Markdown 桌面编辑器。

[English](README.md) | **简体中文**

Rypora 直接在同一个所见即所得画布里编辑纯 Markdown：没有分栏预览，也不做
“Markdown → HTML → Markdown” 的来回转换。公式、图表、表格、任务列表和图片都在正文中
即时渲染，而磁盘上的文件始终是普通 Markdown。

## 功能

**编辑**

- 真正的所见即所得：标题、粗体 / 斜体 / 删除线、引用、有序 / 无序 / 任务列表、表格、
  围栏代码块、分割线
- 行内公式（`$…$`）与块级公式（`$$…$$`）由 KaTeX 渲染，双击公式即可修改
- Mermaid 图表在文档中实时预览，导出时渲染为 SVG
- 代码块语法高亮（Rust、TypeScript/JavaScript、Python、Go、Java、C/C++、SQL、JSON、
  YAML、Bash 等），基于 Prism / refractor
- 多标签编辑、工作区文件树、文档大纲、工作区搜索、文档内查找替换
- 图片：粘贴或拖入后保存到文档同级的 `assets/` 目录；相对路径、绝对路径、`file://`
  URL、远程 `https` 图片和 `data:` URL 都能正常显示
- 中英文混排的字数与字符统计，状态栏实时显示行列号

**工作区与文件**

- 可以从应用内、访达双击、`open -a Rypora 文档.md` 或命令行参数打开文档
- 文件树支持新建文件 / 文件夹、重命名、删除（移入系统废纸篓）
- 自动保存（可配置防抖），并检测外部修改、提示冲突（mtime + BLAKE3）
- 原子写入（临时文件 + rename），崩溃不会留下写了一半的文档
- 关闭脏标签页或窗口时，弹出 **保存 / 不保存 / 取消** 三按钮对话框，避免误丢改动

**外观与导出**

- 浅色、深色、跟随系统三种主题；专注模式与打字机模式
- 可调字号、行宽、侧边栏显隐与拼写检查
- 设置跨启动持久化
- 导出为自包含的 HTML（内联 KaTeX 样式、Mermaid 渲染为 SVG、重新应用语法高亮），
  或通过系统打印对话框导出 PDF

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 桌面外壳 | Tauri v2（Rust，`tauri` 2.x） |
| 前端 | React 19、TypeScript、Vite 8 |
| 状态管理 | Zustand 5 |
| 编辑器内核 | Milkdown 7 / ProseMirror |
| 数学公式 | KaTeX + `remark-math` |
| 图表 | Mermaid 11 |
| 语法高亮 | Prism / refractor |
| 后端 crate | `notify`、`ignore`、`trash`、`blake3`、`serde` |

## 环境要求

- **Node.js** 20.19+（推荐 22 LTS）与 npm
- **Rust** stable 1.85+（workspace 使用 edition 2024）
- macOS：Xcode Command Line Tools（`xcode-select --install`）
- Linux / Windows：参见 [Tauri v2 前置依赖](https://v2.tauri.app/start/prerequisites/)
  （Windows 需要 WebView2，Linux 需要 `webkit2gtk`）

目前以 macOS 为主要目标平台，其他平台尚未验证。

## 开始使用

```bash
npm install
npm run tauri dev
```

开发服务器运行在 <http://localhost:1420>，Tauri 窗口会自动打开。

只调试前端、不启动 Rust 外壳：

```bash
npm run dev
# 打开 http://localhost:1420/?demo=1 可加载演示文档
```

`?demo=1` 仅在开发模式生效，会写入一篇包含公式、Mermaid、表格、任务列表和代码块的
示例文档。

## 构建

```bash
npm run tauri build
```

产物位于 `target/release/bundle/`：

- `macos/Rypora.app` —— 应用包
- `dmg/Rypora_<版本>_<架构>.dmg` —— 磁盘映像

DMG 打包会通过 AppleScript 让 Finder 自动排版磁盘映像窗口。在无图形会话或未授予
自动化权限的环境里，这一步可能长时间无响应；此时只构建应用包：

```bash
npm run tauri build -- --bundles app
```

构建产物为 ad-hoc 签名，本地运行足够。分发给其他机器需要 Apple Developer 证书并完成
公证。

## 快捷键

Windows / Linux 上 `⌘` 对应 `Ctrl`。

**文件**

| 操作 | 快捷键 |
| --- | --- |
| 新建文件 | ⌘N |
| 打开文件… | ⌘O |
| 打开文件夹… | ⌘⇧O |
| 保存 | ⌘S |
| 另存为… | ⌘⇧S |
| 关闭标签页 | ⌘W |
| 退出 | ⌘Q |

**编辑**

| 操作 | 快捷键 |
| --- | --- |
| 撤销 / 重做 | ⌘Z / ⌘⇧Z |
| 查找… | ⌘F |
| 查找与替换… | ⌘⌥F |
| 设置… | ⌘, |

**格式**

| 操作 | 快捷键 |
| --- | --- |
| 粗体 | ⌘B |
| 斜体 | ⌘I |
| 删除线 | ⌘⇧X |
| 行内代码 | ⌘E |
| 链接… | ⌘K |
| 标题 1–6 | ⌘1 … ⌘6 |
| 正文 | ⌘0 |
| 引用 | ⌘⇧Q |
| 代码块 | ⌘⇧K |
| 无序列表 | ⌘⇧8 |
| 有序列表 | ⌘⇧7 |
| 任务列表 | ⌘⇧9 |
| 表格 | ⌘T |
| 图片… | ⌘⇧I |

**视图**

| 操作 | 快捷键 |
| --- | --- |
| 切换侧边栏 | ⌘⇧L |
| 切换深色模式 | ⌘⇧D |
| 专注模式 | ⌘⇧F |
| 打字机模式 | ⌘⇧T |

原生菜单栏提供同样的命令，另有窗口控制、全屏，以及 **帮助** 下的键盘快捷键一览。

## 目录结构

```
src/                      React 前端
  App.tsx                 布局、菜单 / 拖放 / 打开文件接线、自动保存
  components/             标题栏、标签栏、侧边栏、文件树、大纲、搜索、
                          状态栏、查找栏、设置与各类对话框
  editor/                 Milkdown 装配与自定义插件
    EditorPane.tsx        编辑器实例、插件组合、大纲与选区信息
    math.ts               KaTeX 行内 / 块级节点
    mermaid.ts            图表实时预览组件
    images.ts             图片节点视图、粘贴 / 拖入处理
    tasks.ts              任务列表渲染与勾选
    highlight.ts          共享的 Prism / refractor 配置
    focus.ts              专注模式与打字机模式
    commands.ts           格式化命令与大纲提取
  lib/                    IPC 封装、文件操作、导出、路径工具、自测
  stores/                 Zustand 状态：tabs、workspace、ui、settings
  styles/index.css        应用样式与打印样式
src-tauri/                Rust 后端
  src/lib.rs              Builder、插件、窗口 / 菜单事件、待打开文件
  src/commands/fs.rs      读写、目录树、重命名 / 删除、图片
  src/commands/search.rs  工作区搜索
  src/menu.rs             原生中文菜单栏
  src/watcher.rs          基于 `notify` 的递归文件监听
  src/error.rs            可序列化的错误类型
  tauri.conf.json         窗口、CSP、asset 协议、打包信息
```

## 实现说明

### 编辑器

每个标签页各自持有一个 Milkdown（ProseMirror）实例。Markdown 是唯一数据源：`listener`
在每次变更后把文档序列化为 Markdown，保存的就是这个字符串。自定义插件负责公式、图表、
任务勾选框和图片的渲染，但不会改变写回磁盘的 Markdown。

- **公式**：用 `remark-math` 解析、KaTeX 节点视图显示；编辑公式时弹出输入框（MVP 方案，
  不是完整的公式编辑器）。
- **Mermaid**：围栏代码块通过 widget decoration 显示预览；导出时替换为渲染后的 SVG。
- **任务列表**：不使用原生 `<input>`（会和 ProseMirror 冲突），勾选框用 CSS 伪元素绘制，
  由点击处理函数切换节点的 `checked`。
- **图片**：按当前文档目录解析路径。粘贴或拖入的图片写入文档同级 `assets/`（自动以
  `name-1.png` 去重），并以相对路径插入。

### 文件读写与冲突

`save_file` 会带上调用方期望的 `mtime` 与内容哈希；写入前重新读取文件，只要其中一项
发生变化就返回 `conflict` 错误，从而避免静默覆盖 Rypora 之外做出的修改。写入先落到同目录
的临时文件，再 rename 覆盖目标文件。

工作区监听器对创建、修改、删除发出 `fs://changed` 事件；前端据此刷新文件树，并标记磁盘
内容已变化的标签页。

### IPC 接口

| 命令 | 用途 |
| --- | --- |
| `open_file`、`save_file`、`write_text_file` | 读取、带冲突检测的保存、直接写入 |
| `read_dir_tree` | 递归读取目录，用于文件树 |
| `create_file`、`create_folder`、`rename_path`、`delete_path`、`path_exists` | 文件管理（删除走废纸篓） |
| `save_image`、`import_image` | 把图片复制到文档同级 `assets/` |
| `search_workspace` | 按行搜索工作区，列号映射兼容 Unicode |
| `watch_workspace`、`unwatch_workspace` | 安装 / 移除递归监听 |
| `take_pending_files` | 取走启动时传入的文件（访达、`open -a`、argv） |

事件：`menu://action`（原生菜单）、`fs://changed`（文件监听）、`app://open-files`
（应用运行期间打开文档）。

### 安全模型

- 生产 CSP 只允许本地脚本与样式；本地图片走 `asset:` / `http://asset.localhost`，
  远程图片放开 `https:` / `http:`。
- 本地文件通过 Tauri 的 asset 协议提供（`assetProtocol.scope` 为 `**`，文档引用的任意
  图片路径都能加载）。
- capability 文件只授予应用实际用到的 window、dialog、store、window-state 权限。
- 开发模式设置 `devCsp: null`，以便 Vite HMR 工作。

### 设置与数据

设置保存在应用数据目录下的 `settings.json`（macOS：
`~/Library/Application Support/dev.rypora.editor/`），由 `tauri-plugin-store` 管理；
窗口尺寸位置由 `tauri-plugin-window-state` 恢复。

| 设置项 | 默认值 | 范围 / 说明 |
| --- | --- | --- |
| 主题 | 跟随系统 | 自动 / 浅色 / 深色 |
| 字号 | 16 px | 13–24 |
| 行宽 | 760 px | 560–1200 |
| 自动保存 | 开启 | 防抖 300–4000 ms，默认 800 ms |
| 拼写检查 | 开启 | — |
| 侧边栏 | 显示 | 宽度持久化 |
| 最近打开 | — | 最多 24 条 |

## 测试

```bash
# 类型检查 + 生产前端构建
npm run build

# Rust 后端类型检查
cargo check --manifest-path src-tauri/Cargo.toml

# 在真实 Tauri webview 中执行端到端 IPC 自测
npm run selftest
```

`npm run selftest` 会运行 `src/lib/selftest.ts` 里的开发专用测试，针对真实文件系统验证
创建 / 读取 / 写入、冲突检测、目录树、搜索（含 Unicode 偏移）与重命名，并把 JSON 报告写到
`/tmp/rypora-selftest-<时间戳>/report.json`。

## 已知限制

- 公式编辑使用文本输入框，而不是专用公式编辑器。
- Windows / Linux 构建尚未测试。
- 主 JS chunk 约 1.36 MB（Milkdown、KaTeX、Prism），代码拆分仍待优化。
- DMG 打包依赖 Finder 自动化（见[构建](#构建)）。

## 许可证

本项目尚未声明许可证。分发前请先添加 `LICENSE` 文件。
