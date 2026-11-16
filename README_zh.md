<p align="center">
  <img src="app-icon.png" width="120" height="120" alt="Rypora 应用图标" />
</p>

<h1 align="center">Rypora</h1>

<p align="center">
  <strong>一个使用 Rust + Tauri v2 构建的、类似 Typora 的<br />
  所见即所得 Markdown 桌面编辑器</strong>
</p>

<p align="center"><a href="README.md">English</a> · 简体中文</p>

## 简介

Rypora 直接在同一个所见即所得画布里编辑纯 Markdown：没有分栏预览，也不做
“Markdown → HTML → Markdown” 的来回转换。公式、图表、表格、任务列表和图片都在正文中
即时渲染，而磁盘上的文件始终是普通 Markdown。

桌面端基于 **Rust + Tauri v2**，前端使用 **React 19 + Milkdown 7**。文件以普通 `.md`
保存在磁盘上，由 Rust 后端负责原子写入、冲突检测与自动保存。

## 功能

**编辑**

- 真正的所见即所得：标题、粗体 / 斜体 / 删除线、引用、有序 / 无序 / 任务列表、表格、
  围栏代码块、分割线
- Typora 风格扩展语法：下划线、高亮、上标、下标、行内／块级注释、五种警告框、
  链接引用与脚注，均按原样读写为普通 Markdown
- 源代码模式（⌘/）直接编辑 Markdown 原文，与所见即所得视图共用同一份内容
- 行内公式（`$…$`）与块级公式（`$$…$$`）由 KaTeX 渲染，双击公式即可修改
- Mermaid 图表在文档中实时预览，导出时渲染为 SVG
- 代码块语法高亮（Rust、TypeScript/JavaScript、Python、Go、Java、C/C++、SQL、JSON、
  YAML、Bash 等），基于 Prism / refractor
- 多标签编辑、工作区文件树、文档大纲、工作区搜索、文档内查找替换
- 多窗口编辑（⌘⇧N）：每个窗口各自持有标签页，菜单命令作用于当前聚焦窗口
- 快速打开（⌘⇧O）按文件名 / 路径模糊检索已打开标签、最近文件与工作区；
  「文件 → 打开最近文件」同步最近 12 条，⌘⇧T 可重新打开刚关闭的标签
- 图片：粘贴或拖入后保存到文档同级的 `assets/` 目录；相对路径、绝对路径、`file://`
  URL、远程 `https` 图片和 `data:` URL 都能正常显示
- 图片管理：25–200% 缩放、Markdown / HTML 语法互转、复制 / 移动 / 删除图片文件、
  重新加载全部图片，以及为以 `/` 开头的路径设置图片根目录
- 中英文混排的字数与字符统计，状态栏实时显示行列号

**工作区与文件**

- 可以从应用内、访达双击、`open -a Rypora 文档.md` 或命令行参数打开文档
- **导入** Markdown、纯文本与 HTML；HTML 会转换为 Markdown，结果写成源文件同目录的
  `name.md`（不会覆盖已有文件，重名时追加 `-1`）
- 文件树支持新建文件 / 文件夹、重命名、删除（移入系统废纸篓）；「文件 → 删除」将
  当前文档移入废纸篓
- 自动保存（可配置防抖），并检测外部修改、提示冲突（mtime + BLAKE3）
- 原子写入（临时文件 + rename），崩溃不会留下写了一半的文档
- 关闭脏标签页或窗口时，弹出 **保存 / 不保存 / 取消** 三按钮对话框，避免误丢改动
- 打开文件不会弄脏或改写文件：编辑器加载时会规范化 Markdown（例如 `*` 列表项变为
  `-`），并把规范化结果作为基线

**外观与导出**

- 三种界面模式（跟随系统、浅色、深色），外加 Typora 的六套主题：Github、Gothic、
  Newsprint、Night、Pixyll、Whitey；Night 属于深色主题，共用深色语法配色
- 专注模式与打字机模式
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

应用图标位于 `src-tauri/icons/`，由 `app-icon.png`（1024×1024）通过
`npx tauri icon app-icon.png` 生成；可编辑的矢量源文件是 `app-icon.svg`。

## 快捷键

Windows / Linux 上 `⌘` 对应 `Ctrl`。菜单栏与 Typora 一致，为 **文件 / 编辑 / 段落 / 格式 /
显示 / 主题 / 窗口 / 帮助**，已实现的功能沿用 Typora 的同一套快捷键。尚未实现的菜单项
仍然显示，但处于置灰状态。

**文件**

| 操作 | 快捷键 |
| --- | --- |
| 新建 | ⌘N |
| 新建标签页 | ⌘T |
| 新建窗口 | ⌘⇧N |
| 打开… | ⌘O |
| 快速打开… | ⌘⇧O |
| 重新打开关闭的文件 | ⌘⇧T |
| 保存 | ⌘S |
| 另存为… | ⌘⇧S |
| 保存全部打开的文件 | ⌘⌥S |
| 关闭 | ⌘W |
| 打印 / 导出 PDF | ⌘P |
| 退出 | ⌘Q |

**编辑**

| 操作 | 快捷键 |
| --- | --- |
| 撤消 / 重做 | ⌘Z / ⌘⇧Z |
| 全选 | ⌘A |
| 选择段落 / 行 / 词 | ⌘⌥P / ⌘L / ⌘D |
| 选中当前格式文本 | ⌘E |
| 跳转到文首 / 文末 | ⌃⌘↑ / ⌃⌘↓ |
| 跳转到行首 / 行尾 | ⌃A / ⌃E |
| 上移 / 下移该行 | ⌥↑ / ⌥↓ |
| 复制为 Markdown | ⌘⇧C |
| 粘贴为纯文本 | ⌘⇧V |
| 粘贴并匹配样式 | ⌥⌘⇧V |
| 查找… | ⌘F |
| 查找下一个 / 上一个 | ⌘G / ⌘⇧G |
| 查找和替换… | ⌘⌥F |
| 替换下一个 | ⌥⌘E |
| 设置… | ⌘, |

**段落**

| 操作 | 快捷键 |
| --- | --- |
| 一级～六级标题 | ⌘1 … ⌘6 |
| 段落 | ⌘0 |
| 引用 | ⌘⌥Q |
| 代码块 | ⌘⌥C |
| 有序列表 | ⌘⌥O |
| 无序列表 | ⌘⌥U |
| 任务列表 | ⌘⌥X |
| 插入表格 | ⌘⌥T |
| 水平分割线 | ⌘⌥- |
| 链接引用 | ⌘⌥L |
| 脚注 | ⌘⌥R |
| 提醒／建议／重要／警告／注意内容 | 菜单「段落 → 警告框」 |

**格式**

| 操作 | 快捷键 |
| --- | --- |
| 加粗 | ⌘B |
| 斜体 | ⌘I |
| 下划线 | ⌘U |
| 代码 | ⌃&#96; |
| 删除线 | ⌃⇧&#96; |
| 高亮 | ⌘⇧H |
| 上标 / 下标 | 菜单「格式」 |
| 内联公式 | ⌃M |
| 注释 | ⌃- |
| 链接… | ⌘K |
| 插入图片… | ⌃⌘I |
| 清除样式 | ⌘\ |

**显示**

| 操作 | 快捷键 |
| --- | --- |
| 显示／隐藏侧边栏 | ⌘⇧L |
| 专注模式 | F8 |
| 打字机模式 | F9 |
| 大纲 / 文档列表 / 文件树 | ⌃⌘1 / ⌃⌘2 / ⌃⌘3 |
| 搜索 | ⌘⇧F |
| 实际大小 | ⌘⇧0 |
| 放大 / 缩小 | ⌘⇧= / ⌘⇧- |
| 源代码模式 | ⌘/ |

**主题**

| 操作 | 位置 |
| --- | --- |
| 跟随系统 / 浅色 / 深色 | 「主题」菜单 |
| Github / Gothic / Newsprint / Night / Pixyll / Whitey | 「主题」菜单或设置 |

原生菜单栏提供同样的命令，另有窗口控制、全屏，以及 **帮助** 下的键盘快捷键一览。
图片缩放、图片语法、复制 / 移动 / 删除图片与图片根目录位于「格式 → 图像」，作用于
光标所在或紧邻光标的图片。

## 目录结构

```
LICENSE                   MIT 许可证
app-icon.png              应用图标源图（1024×1024），`tauri icon` 的输入
app-icon.svg              可编辑的图标矢量稿
src/                      React 前端
  App.tsx                 布局、菜单 / 拖放 / 打开文件接线、自动保存
  components/             标题栏、标签栏、侧边栏、文件树、大纲、搜索、
                          状态栏、查找栏、快速打开、设置与各类对话框
  editor/                 Milkdown 装配与自定义插件
    EditorPane.tsx        编辑器实例、插件组合、大纲与选区信息
    extensions.ts         下划线 / 高亮 / 上下标 / 注释 / 警告框 / 链接引用 /
                          脚注 / HTML 图片语法
    math.ts               KaTeX 行内 / 块级节点
    mermaid.ts            图表实时预览组件
    images.ts             图片节点视图、粘贴 / 拖入处理、缩放
    tasks.ts              任务列表渲染与勾选
    highlight.ts          共享的 Prism / refractor 配置
    focus.ts              专注模式与打字机模式
    commands.ts           格式化、表格、图片与选区命令
  lib/                    IPC 封装、文件操作、导出、导入（HTML → Markdown）、
                          模糊匹配、Markdown 比较、路径、剪贴板、自测
  stores/                 Zustand 状态：tabs、workspace、ui、settings
  styles/index.css        应用样式、Typora 主题与打印样式
src-tauri/                Rust 后端
  src/lib.rs              Builder、插件、多窗口与按窗口的待打开文件、最近文件菜单同步
  src/commands/fs.rs      读写、目录树、重命名 / 删除、图片
  src/commands/search.rs  工作区搜索
  src/commands/platform.rs 剪贴板、访达定位、外部链接
  src/menu.rs             原生中文菜单栏（含打开最近文件）
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

### 扩展语法

下划线、高亮、上标、下标、注释、警告框、链接引用和脚注没有标准 mdast 节点。
`src/editor/extensions.ts` 用一个 remark 转换器把它们从文本／HTML／引用块中识别出来，
再为每种语法注册 ProseMirror mark 或节点，以及一对配套的 `toMarkdown` handler 写回
`<u>…</u>`、`==…==`、`^…^`、`~…~`、`<!--…-->`、`> [!NOTE]` 和链接定义等原文：

- 扩展语法只影响编辑器内部表示，磁盘上仍是普通 Markdown，其他编辑器也能读取。
- 为让 `~x~` 表示下标，GFM 的 `singleTilde` 被关闭；`~~x~~` 仍是删除线。
- 警告框显示为带颜色的块，正文仍保存为 `> [!KIND]` 引用块。
- 脚注复用 GFM 的 `footnote_reference` / `footnote_definition`，插入时自动追加定义。
- 源代码模式把同一份 `tab.content` 放进纯文本区域，保存路径与所见即所得视图一致。

### 多窗口、最近文件与快速打开

**新建窗口** 通过 `new_window` 创建 `doc-N` webview 窗口，加载同一个前端入口。待打开
文件按窗口 label 分别存储，因此在另一个窗口聚焦时执行 `open -a Rypora 文档.md`，文件会
在聚焦窗口打开；菜单事件同样只发给聚焦窗口。

前端把最多 24 条最近路径保存在设置里，并通过 `set_recent_files` 推给 Rust；Rust 重建
原生菜单，「打开最近文件」按由新到旧列出最多 12 条，ID 为
`file.recent.open.<index>`。⌘⇧T 从已关闭标签栈中恢复。

快速打开把已打开标签、最近文件与工作区文件树合并，再用模糊匹配按完整路径排序
（子序列匹配，并对词首与连续命中加权）。

### 图片

图片是带有 `src`、`alt`、`title`、`zoom` 与 `syntax` 的 ProseMirror 节点。`zoom` 是
缩放百分比（0 表示默认），由节点视图应用；`syntax` 记录文档里保存为 `![alt](src)` 还是
`<img …>`。HTML 形式会被解析回图片节点，因此在两种语法之间切换是无损的，缩放写成
`style="zoom:50%;"`。

相对路径按文档所在目录解析。设置图片根目录后，以 `/` 开头的路径改为相对该根目录解析，
而不是文件系统根目录（即 Typora 的「图片根目录」语义）。复制 / 移动 / 删除作用于图片
对应的文件；删除前会确认，移动后文档中的 `src` 会同步改写。

### 导入

「文件 → 导入」支持 Markdown、纯文本与 HTML。Markdown 原样复制，纯文本保留段落分隔，
HTML 由一个轻量 DOM 遍历器（`src/lib/html.ts`）把标题、列表、表格、代码、强调、链接
和图片转换为 Markdown。结果写到源文件同目录的 `name.md`；若已存在，则依次尝试
`name-1.md`、`name-2.md`…… 项目不依赖 pandoc，因此 Word / LaTeX / ePub 的导入导出
保持置灰。

### 主题

主题就是普通 CSS：六套 Typora 主题在 `[data-theme="…"]` 下覆盖同一组 token（`--bg`、
`--text`、`--accent` 等）。`auto` 根据 `prefers-color-scheme` 解析为 `light` 或 `dark`；
仅在深色下生效的 token 覆盖挂在 `[data-dark="true"]` 上，Night 因此也能共用。

### 文件读写与冲突

`save_file` 会带上调用方期望的 `mtime` 与内容哈希；写入前重新读取文件，只要其中一项
发生变化就返回 `conflict` 错误，从而避免静默覆盖 Rypora 之外做出的修改。写入先落到同目录
的临时文件，再 rename 覆盖目标文件。

工作区监听器对创建、修改、删除发出 `fs://changed` 事件；前端据此刷新文件树，并标记磁盘
内容已变化的标签页。

### IPC 接口

| 命令 | 用途 |
| --- | --- |
| `open_file`、`save_file`、`write_text_file`、`read_text_file` | 读取、带冲突检测的保存、直接写入 |
| `read_dir_tree` | 递归读取目录，用于文件树 |
| `create_file`、`create_folder`、`rename_path`、`delete_path`、`path_exists` | 文件管理（删除走废纸篓） |
| `delete_file` | 永久删除单个文件（用于删除图片） |
| `save_image`、`import_image`、`copy_image`、`move_image` | 把图片写入 `assets/`、复制或移动图片文件 |
| `search_workspace` | 按行搜索工作区，列号映射兼容 Unicode |
| `watch_workspace`、`unwatch_workspace` | 安装 / 移除递归监听 |
| `take_pending_files(window)`、`new_window` | 按窗口取走待打开文件、新建窗口 |
| `set_recent_files`、`focus_all_windows` | 重建「打开最近文件」菜单、置前所有窗口 |

事件：`menu://action`（原生菜单，发给聚焦窗口）、`fs://changed`（文件监听）、
`app://open-files`（应用运行期间打开文档）。

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
| 主题 | 跟随系统 | 自动 / 浅色 / 深色，另加 github、gothic、newsprint、night、pixyll、whitey |
| 字号 | 16 px | 13–24 |
| 行宽 | 760 px | 560–1200 |
| 自动保存 | 开启 | 防抖 300–4000 ms，默认 800 ms |
| 拼写检查 | 开启 | — |
| 侧边栏 | 显示 | 宽度持久化 |
| 最近打开 | — | 保存 24 条，菜单列出 12 条 |
| 图片根目录 | 未设置 | 以 `/` 开头的图片路径相对此目录解析 |

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
- 源代码模式是纯文本区域，暂不做语法高亮。
- 链接定义以只读块显示，修改地址需进入源代码模式。
- 导入仅支持 Markdown、纯文本与 HTML；Word、LaTeX、ePub 需要 pandoc 等外部转换器，
  仍保持置灰。
- 图片缩放以 HTML `<img style="zoom:…">` 保存；转回 Markdown 语法会丢弃缩放。
- DMG 打包依赖 Finder 自动化（见[构建](#构建)）。

## 许可证

本项目基于 [MIT 许可证](LICENSE) 发布。

Copyright © 2026 wangguodong-f。
