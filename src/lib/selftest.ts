import {
  createFile,
  createFolder,
  isTauri,
  openFile,
  pathExists,
  readDirTree,
  renamePath,
  saveFile,
  searchWorkspace,
  writeTextFile,
} from "./ipc";
import { isConflict } from "./errors";

interface StepResult {
  name: string;
  ok: boolean;
  detail?: string;
}

/**
 * Development-only smoke test for the filesystem IPC layer.
 * Run with `VITE_SELFTEST=1 npm run tauri dev`; results are written to
 * `/tmp/rypora-selftest/report.json` for inspection outside the webview.
 */
export async function runSelfTest(): Promise<void> {
  if (!isTauri()) return;
  const steps: StepResult[] = [];
  const base = `/tmp/rypora-selftest-${Date.now()}`;
  const file = `${base}/note.md`;
  const renamed = `${base}/renamed.md`;

  const record = (name: string, ok: boolean, detail?: string) => {
    steps.push({ name, ok, detail });
  };

  const attempt = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      record(name, true);
    } catch (error) {
      record(name, false, error instanceof Error ? error.message : String(error));
    }
  };

  await attempt("create-folder", async () => {
    await createFolder(base);
    if (!(await pathExists(base))) throw new Error("folder missing");
  });

  let createdMtime: number | null = null;
  let createdHash: string | null = null;
  let savedHash = "";

  await attempt("create-file", async () => {
    await createFile(file);
    const file1 = await openFile(file);
    createdMtime = file1.mtime;
    createdHash = file1.hash;
  });

  await attempt("save-file", async () => {
    const content = "# 标题\n\nhello 世界\n";
    const result = await saveFile(file, content, createdMtime, createdHash);
    savedHash = result.hash;
    const reread = await openFile(file);
    if (reread.content !== content) throw new Error("content mismatch");
    if (reread.hash !== result.hash) throw new Error("hash mismatch");
  });

  await attempt("conflict-detection", async () => {
    let conflicted = false;
    try {
      await saveFile(file, "stale", createdMtime, createdHash);
    } catch (error) {
      conflicted = isConflict(error);
    }
    if (!conflicted) throw new Error("stale save was not rejected");
  });

  await attempt("external-change", async () => {
    await writeTextFile(file, "# changed\n");
    const reread = await openFile(file);
    if (reread.hash === savedHash) throw new Error("hash did not change");
  });

  await attempt("read-dir-tree", async () => {
    const tree = await readDirTree(base);
    const names = tree.map((node) => node.name);
    if (!names.includes("note.md")) throw new Error(`tree=${names.join(",")}`);
  });

  await attempt("search-workspace", async () => {
    const hits = await searchWorkspace(base, "CHANGED", false, 20);
    if (!hits.length) throw new Error("no hits");
    if (hits[0].line !== 1) throw new Error(`line=${hits[0].line}`);
  });

  await attempt("search-unicode", async () => {
    await writeTextFile(`${base}/unicode.md`, "İstanbul 与 中文搜索\n");
    const hits = await searchWorkspace(base, "中文搜索", false, 20);
    if (!hits.length) throw new Error("no unicode hits");
    if (hits[0].column !== 12) throw new Error(`column=${hits[0].column}`);
  });

  await attempt("rename-path", async () => {
    await renamePath(file, renamed);
    if (!(await pathExists(renamed))) throw new Error("renamed file missing");
    if (await pathExists(file)) throw new Error("old file still exists");
  });

  await attempt("write-report", async () => {
    await writeTextFile(
      `${base}/report.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          steps,
          passed: steps.every((step) => step.ok),
        },
        null,
        2,
      ),
    );
  });
}
