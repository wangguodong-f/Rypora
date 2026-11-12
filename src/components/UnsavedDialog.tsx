import { useEffect, useRef } from "react";
import { useUi } from "../stores/ui";

/**
 * Three-way prompt shown before closing a tab or the window: save, discard,
 * or cancel. A plain `confirm()` only has two buttons, so "cancel" would have
 * to discard the document — this dialog keeps the safe choice available.
 */
export function UnsavedDialog() {
  const state = useUi((store) => store.unsavedState);
  const resolve = useUi((store) => store.resolveUnsaved);
  const saveRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!state) return;
    window.setTimeout(() => saveRef.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolve("cancel");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, resolve]);

  if (!state) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => resolve("cancel")}>
      <div
        className="modal unsaved-modal"
        role="alertdialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{state.title}</h2>
        </header>
        <div className="modal-body">
          <p className="unsaved-message">{state.message}</p>
        </div>
        <footer className="modal-footer">
          <button className="text-button" onClick={() => resolve("cancel")}>
            取消
          </button>
          <button
            className="text-button danger"
            onClick={() => resolve("discard")}
          >
            不保存
          </button>
          <button
            ref={saveRef}
            className="primary-button"
            onClick={() => resolve("save")}
          >
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}
