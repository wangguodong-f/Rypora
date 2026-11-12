# Rypora

A Typora-like, what-you-see-is-what-you-get Markdown desktop editor built with **Rust + Tauri v2**.

**English** | [简体中文](README_zh.md)

Rypora opens plain Markdown files in a single WYSIWYG surface: no split preview, no
rendered-HTML round trip. Math, diagrams, tables, task lists and images render inline
while the file on disk stays ordinary Markdown.

## Features

**Editing**

- True WYSIWYG editing for headings, bold / italic / strikethrough, quotes, ordered,
  unordered and task lists, tables, fenced code blocks and horizontal rules
- Inline (`$…$`) and block (`$$…$$`) math rendered with KaTeX; double-click a formula to edit it
- Mermaid diagrams previewed live inside the document, and rendered to SVG on export
- Syntax highlighting in code fences (Rust, TypeScript/JavaScript, Python, Go, Java,
  C/C++, SQL, JSON, YAML, Bash, and more) via Prism / refractor
- Multi-tab editing, a workspace file tree, a document outline, workspace search, and
  in-document find & replace
- Images: paste or drag & drop to save them into `assets/` next to the document;
  relative paths, absolute paths, `file://` URLs, remote `https` images and `data:` URLs
  all render
- CJK-aware word and character counts, plus live line/column in the status bar

**Workspace & files**

- Open files from the app, from Finder (double-click), with `open -a Rypora note.md`,
  or from the command line
- File tree operations: create file/folder, rename, delete (moves to the system Trash)
- Autosave with a configurable debounce, plus external-change detection and conflict
  prompts (mtime + BLAKE3)
- Atomic writes (temporary file + rename) so a crash never leaves a half-written document
- A three-way **Save / Don't Save / Cancel** dialog guards closing a dirty tab or the
  window

**Appearance & export**

- Light, dark and follow-system themes; focus mode and typewriter mode
- Adjustable font size, line width, sidebar visibility and spellcheck
- Settings persist across launches
- Export to a self-contained HTML file (KaTeX CSS inlined, Mermaid rendered to SVG,
  syntax highlighting reapplied) or to PDF through the system print dialog

## Tech stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Tauri v2 (Rust, `tauri` 2.x) |
| Frontend | React 19, TypeScript, Vite 8 |
| State | Zustand 5 |
| Editor | Milkdown 7 / ProseMirror |
| Math | KaTeX + `remark-math` |
| Diagrams | Mermaid 11 |
| Highlighting | Prism / refractor |
| Backend crates | `notify`, `ignore`, `trash`, `blake3`, `serde` |

## Requirements

- **Node.js** 20.19+ (22 LTS recommended) and npm
- **Rust** stable 1.85+ (the workspace uses edition 2024)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux / Windows: the usual [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
  (WebView2 on Windows, `webkit2gtk` on Linux)

macOS is the primary target today; other platforms are not yet verified.

## Getting started

```bash
npm install
npm run tauri dev
```

The dev server runs on <http://localhost:1420> and the Tauri window opens automatically.

To work on the frontend only, without the Rust shell:

```bash
npm run dev
# open http://localhost:1420/?demo=1 for a demo document
```

`?demo=1` is development-only; it seeds a sample document that exercises math, Mermaid,
tables, task lists and code blocks.

## Building

```bash
npm run tauri build
```

Bundles land in `target/release/bundle/`:

- `macos/Rypora.app` — the application bundle
- `dmg/Rypora_<version>_<arch>.dmg` — the disk image

DMG packaging asks Finder (through AppleScript) to arrange the disk-image window. In a
headless session or without automation permission that step can stall indefinitely; build
just the app bundle in that case:

```bash
npm run tauri build -- --bundles app
```

The build is ad-hoc signed, which is fine for local use. Distributing to other machines
requires an Apple Developer certificate and notarization.

App icons live in `src-tauri/icons/` and are generated from `app-icon.png` (1024×1024)
with `npx tauri icon app-icon.png`. The editable artwork is in `app-icon.svg`.

## Keyboard shortcuts

`⌘` is `Ctrl` on Windows/Linux.

**Files**

| Action | Shortcut |
| --- | --- |
| New file | ⌘N |
| Open file… | ⌘O |
| Open folder… | ⌘⇧O |
| Save | ⌘S |
| Save as… | ⌘⇧S |
| Close tab | ⌘W |
| Quit | ⌘Q |

**Editing**

| Action | Shortcut |
| --- | --- |
| Undo / Redo | ⌘Z / ⌘⇧Z |
| Find… | ⌘F |
| Find & replace… | ⌘⌥F |
| Settings… | ⌘, |

**Formatting**

| Action | Shortcut |
| --- | --- |
| Bold | ⌘B |
| Italic | ⌘I |
| Strikethrough | ⌘⇧X |
| Inline code | ⌘E |
| Link… | ⌘K |
| Heading 1–6 | ⌘1 … ⌘6 |
| Paragraph | ⌘0 |
| Quote | ⌘⇧Q |
| Code block | ⌘⇧K |
| Bullet list | ⌘⇧8 |
| Ordered list | ⌘⇧7 |
| Task list | ⌘⇧9 |
| Table | ⌘T |
| Image… | ⌘⇧I |

**View**

| Action | Shortcut |
| --- | --- |
| Toggle sidebar | ⌘⇧L |
| Toggle dark mode | ⌘⇧D |
| Focus mode | ⌘⇧F |
| Typewriter mode | ⌘⇧T |

The native menu bar exposes the same commands, plus window controls, full screen and a
keyboard-shortcut reference under **Help**.

## Project layout

```
LICENSE                   MIT license
app-icon.png              App icon source (1024×1024), input for `tauri icon`
app-icon.svg              Editable icon artwork
src/                      React frontend
  App.tsx                 Layout, menu/drag-drop/open-file wiring, autosave
  components/             Title bar, tabs, sidebar, file tree, outline, search,
                          status bar, find bar, settings and dialogs
  editor/                 Milkdown setup and custom plugins
    EditorPane.tsx        Editor instance, plugin composition, outline/selection
    math.ts               KaTeX inline and block nodes
    mermaid.ts            Live diagram widget
    images.ts             Image node view, paste/drop handling
    tasks.ts              Task list rendering and toggling
    highlight.ts          Shared Prism/refractor setup
    focus.ts              Focus and typewriter modes
    commands.ts           Formatting commands and outline extraction
  lib/                    IPC wrappers, file actions, export, path helpers, self-test
  stores/                 Zustand stores: tabs, workspace, ui, settings
  styles/index.css        App styles and print styles
src-tauri/                Rust backend
  src/lib.rs              Builder, plugins, window/menu events, pending file opens
  src/commands/fs.rs      Read/write, directory tree, rename/delete, images
  src/commands/search.rs  Workspace search
  src/menu.rs             Native (Chinese) menu bar
  src/watcher.rs          Recursive file watching via `notify`
  src/error.rs            Serializable error type
  tauri.conf.json         Window, CSP, asset protocol, bundle metadata
```

## How it works

### Editor

Each tab owns a Milkdown (ProseMirror) instance. Markdown is the source of truth:
`listener` serializes the document on every change, and the resulting Markdown string is
what gets saved. Custom plugins render math, diagrams, task checkboxes and images without
altering the Markdown that is written back to disk.

- **Math** uses `remark-math` for parsing and KaTeX node views for display. Editing an
  equation opens a small prompt (an MVP choice, not a full equation editor).
- **Mermaid** fences are shown through a widget decoration; export replaces them with
  rendered SVG.
- **Task lists** avoid native `<input>` elements (which fight with ProseMirror); checkboxes
  are CSS pseudo-elements and a click handler toggles `checked` on the node.
- **Images** are resolved per document directory. Pasted or dropped files are written to
  `assets/` beside the document (with automatic `name-1.png` de-duplication) and inserted
  as relative paths.

### File I/O and conflicts

`save_file` takes the caller's expected `mtime` and content hash. It re-reads the file
before writing and returns a `conflict` error if either changed, so edits made outside
Rypora are never silently overwritten. Writes go to a temporary file in the same directory
and are then renamed over the target.

The workspace watcher emits `fs://changed` events for creates, modifications and removals;
the frontend refreshes the tree and flags tabs whose file changed on disk.

### IPC surface

| Command | Purpose |
| --- | --- |
| `open_file`, `save_file`, `write_text_file` | Read, conflict-checked save, direct write |
| `read_dir_tree` | Recursive directory listing for the file tree |
| `create_file`, `create_folder`, `rename_path`, `delete_path`, `path_exists` | File management (delete uses the Trash) |
| `save_image`, `import_image` | Copy images into `assets/` next to the document |
| `search_workspace` | Line-based workspace search with Unicode-safe column mapping |
| `watch_workspace`, `unwatch_workspace` | Install / drop the recursive watcher |
| `take_pending_files` | Drain files passed at launch (Finder, `open -a`, argv) |

Events: `menu://action` (native menu), `fs://changed` (watcher), `app://open-files`
(document opened while the app is running).

### Security model

- The production CSP only allows local scripts and styles, `asset:` / `http://asset.localhost`
  for local images, and `https:` / `http:` for remote images.
- Local files are served through Tauri's asset protocol (`assetProtocol.scope` is `**`, so
  any image path referenced by a document can load).
- The capability file grants only the window, dialog, store and window-state permissions
  the app actually uses.
- Dev builds run with `devCsp: null` for Vite HMR.

### Settings and data

Settings live in `settings.json` in the app data directory
(macOS: `~/Library/Application Support/dev.rypora.editor/`), managed by
`tauri-plugin-store`. Window geometry is restored by `tauri-plugin-window-state`.

| Setting | Default | Range / notes |
| --- | --- | --- |
| Theme | Follow system | auto / light / dark |
| Font size | 16 px | 13–24 |
| Line width | 760 px | 560–1200 |
| Autosave | On | debounce 300–4000 ms, default 800 ms |
| Spellcheck | On | — |
| Sidebar | Visible | width persisted |
| Recent files | — | up to 24 entries |

## Testing

```bash
# Type check + production frontend build
npm run build

# Rust backend type check
cargo check --manifest-path src-tauri/Cargo.toml

# End-to-end IPC self-test inside the real Tauri webview
npm run selftest
```

`npm run selftest` runs the development-only suite in `src/lib/selftest.ts` against the real
filesystem: create/read/write, conflict detection, directory tree, search (including
Unicode offsets) and rename. It writes a JSON report to
`/tmp/rypora-selftest-<timestamp>/report.json`.

## Known limitations

- Equation editing uses a text prompt rather than a dedicated equation editor.
- Windows and Linux builds are untested.
- The main JS chunk is about 1.36 MB (Milkdown, KaTeX and Prism); code splitting is a
  pending optimisation.
- DMG creation depends on Finder automation (see [Building](#building)).

## License

Released under the [MIT License](LICENSE).

Copyright © 2026 wangguodong-f.
