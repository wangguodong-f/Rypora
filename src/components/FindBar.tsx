import { useEffect, useRef, useState } from "react";
import { runCommand } from "../editor/editorBus";
import { useUi } from "../stores/ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconClose,
  IconReplace,
  IconSearch,
} from "./Icons";

export function FindBar() {
  const open = useUi((state) => state.findOpen);
  const setOpen = useUi((state) => state.setFindOpen);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [result, setResult] = useState<{ index: number; total: number }>({
    index: -1,
    total: 0,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.select(), 20);
    }
  }, [open]);

  if (!open) return null;

  const next = (backwards = false) => {
    if (!query) return;
    const found = runCommand("find", query, backwards);
    if (found) setResult(found);
  };

  const replaceCurrent = () => {
    if (!query) return;
    const found = runCommand("replaceCurrent", query, replacement);
    if (found) setResult(found);
  };

  const replaceAll = () => {
    if (!query) return;
    const count = runCommand("replaceAll", query, replacement);
    setResult({ index: -1, total: 0 });
    useUi.getState().flash(`已替换 ${count ?? 0} 处`);
  };

  return (
    <div className="findbar">
      <div className="findbar-row">
        <IconSearch size={14} />
        <input
          ref={inputRef}
          value={query}
          placeholder="查找"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              next(event.shiftKey);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <span className="findbar-count">
          {query
            ? result.total
              ? `${result.index + 1} / ${result.total}`
              : "无结果"
            : ""}
        </span>
        <button className="icon-button small" title="上一个" onClick={() => next(true)}>
          <IconArrowUp size={14} />
        </button>
        <button className="icon-button small" title="下一个" onClick={() => next(false)}>
          <IconArrowDown size={14} />
        </button>
        <button
          className={`icon-button small${showReplace ? " active" : ""}`}
          title="替换"
          onClick={() => setShowReplace((value) => !value)}
        >
          <IconReplace size={14} />
        </button>
        <button
          className="icon-button small"
          title="关闭"
          onClick={() => setOpen(false)}
        >
          <IconClose size={14} />
        </button>
      </div>
      {showReplace && (
        <div className="findbar-row replace-row">
          <input
            value={replacement}
            placeholder="替换为"
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                replaceCurrent();
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          <button className="text-button" onClick={replaceCurrent}>
            替换
          </button>
          <button className="text-button" onClick={replaceAll}>
            全部替换
          </button>
        </div>
      )}
    </div>
  );
}
