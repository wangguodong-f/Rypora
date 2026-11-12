import { useEffect, useRef, useState } from "react";
import { useUi } from "../stores/ui";

export function PromptDialog() {
  const state = useUi((store) => store.promptState);
  const resolvePrompt = useUi((store) => store.resolvePrompt);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (state) {
      setValue(state.value);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [state]);

  if (!state) return null;

  const submit = () => resolvePrompt(value);
  const cancel = () => resolvePrompt(null);

  return (
    <div className="modal-backdrop" onMouseDown={cancel}>
      <div
        className="modal prompt-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{state.title}</h2>
        </header>
        <div className="modal-body">
          <input
            ref={inputRef}
            className="prompt-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
        </div>
        <footer className="modal-footer">
          <button className="text-button" onClick={cancel}>
            取消
          </button>
          <button className="primary-button" onClick={submit}>
            确定
          </button>
        </footer>
      </div>
    </div>
  );
}
