import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import "katex/dist/katex.min.css";

const container = document.getElementById("root");
if (!container) throw new Error("missing #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV && import.meta.env.VITE_SELFTEST === "1") {
  void import("./lib/selftest").then((module) => module.runSelfTest());
}
