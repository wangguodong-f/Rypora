import { defaultSettings, useSettings } from "../stores/settings";
import { useUi } from "../stores/ui";
import type { ThemeMode } from "../lib/types";
import { IconClose } from "./Icons";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "auto", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

export function SettingsDialog() {
  const open = useUi((state) => state.settingsOpen);
  const setOpen = useUi((state) => state.setSettingsOpen);
  const settings = useSettings();

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>设置</h2>
          <button
            className="icon-button small"
            onClick={() => setOpen(false)}
            title="关闭"
          >
            <IconClose size={15} />
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-group">
            <h3>外观</h3>
            <div className="settings-row">
              <label>主题</label>
              <div className="segmented">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={settings.theme === theme.id ? "active" : ""}
                    onClick={() => settings.update({ theme: theme.id })}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <label>
                正文字号
                <span className="settings-value">{settings.fontSize}px</span>
              </label>
              <input
                type="range"
                min={13}
                max={24}
                step={1}
                value={settings.fontSize}
                onChange={(event) =>
                  settings.update({ fontSize: Number(event.target.value) })
                }
              />
            </div>
            <div className="settings-row">
              <label>
                内容宽度
                <span className="settings-value">{settings.lineWidth}px</span>
              </label>
              <input
                type="range"
                min={560}
                max={1200}
                step={20}
                value={settings.lineWidth}
                onChange={(event) =>
                  settings.update({ lineWidth: Number(event.target.value) })
                }
              />
            </div>
          </section>

          <section className="settings-group">
            <h3>编辑器</h3>
            <div className="settings-row inline">
              <label>自动保存</label>
              <input
                type="checkbox"
                checked={settings.autosave}
                onChange={(event) =>
                  settings.update({ autosave: event.target.checked })
                }
              />
            </div>
            <div className="settings-row">
              <label>
                自动保存延迟
                <span className="settings-value">
                  {settings.autosaveDelay}ms
                </span>
              </label>
              <input
                type="range"
                min={300}
                max={4000}
                step={100}
                disabled={!settings.autosave}
                value={settings.autosaveDelay}
                onChange={(event) =>
                  settings.update({
                    autosaveDelay: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className="settings-row inline">
              <label>拼写检查</label>
              <input
                type="checkbox"
                checked={settings.spellcheck}
                onChange={(event) =>
                  settings.update({ spellcheck: event.target.checked })
                }
              />
            </div>
          </section>
        </div>

        <footer className="modal-footer">
          <button
            className="text-button"
            onClick={() =>
              settings.update({
                ...defaultSettings,
                recentFiles: settings.recentFiles,
                lastFolder: settings.lastFolder,
              })
            }
          >
            恢复默认
          </button>
          <button className="primary-button" onClick={() => setOpen(false)}>
            完成
          </button>
        </footer>
      </div>
    </div>
  );
}
