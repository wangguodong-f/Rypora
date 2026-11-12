import { useUi } from "../stores/ui";
import { runCommand } from "../editor/editorBus";

export function OutlinePanel() {
  const outline = useUi((state) => state.outline);

  if (!outline.length) {
    return (
      <div className="panel-empty">
        <p>当前文档没有标题</p>
        <span>使用 # 添加标题后，大纲会显示在这里。</span>
      </div>
    );
  }

  return (
    <div className="outline-panel">
      {outline.map((item) => (
        <button
          key={`${item.index}-${item.text}`}
          className={`outline-item level-${item.level}`}
          style={{ paddingLeft: 10 + (item.level - 1) * 14 }}
          onClick={() => runCommand("focusHeading", item.index)}
          title={item.text}
        >
          {item.text || "（空标题）"}
        </button>
      ))}
    </div>
  );
}
