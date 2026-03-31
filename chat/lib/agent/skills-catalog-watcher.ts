import fs from "node:fs/promises";
import path from "node:path";

import chokidar from "chokidar";

import { regenerateSkillsIndex } from "./skills-catalog";

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function globalSkillsDir(cwd: string): string {
  return path.join(cwd, ".data", "skills");
}

export async function ensureSkillsIndex(cwd: string): Promise<void> {
  const dir = globalSkillsDir(cwd);
  const p = path.join(dir, "skills.json");
  try {
    await fs.access(p);
  } catch {
    await regenerateSkillsIndex(dir);
  }
}

export function startSkillsIndexWatcher(cwd: string): void {
  if (started) return;
  started = true;
  const dir = globalSkillsDir(cwd);
  const run = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      regenerateSkillsIndex(dir).catch(() => {});
    }, 400);
  };

  void fs.mkdir(dir, { recursive: true }).then(() => regenerateSkillsIndex(dir).catch(() => {}));

  const watcher = chokidar.watch(dir, {
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    depth: 20,
    ignored: (p) => path.basename(p) === "skills.json",
  });
  watcher.on("add", run);
  watcher.on("change", run);
  watcher.on("unlink", run);
  watcher.on("addDir", run);
  watcher.on("unlinkDir", run);
}
