import path from "node:path";

/** Canonical store: `.data/skills/` (git + folder imports + loose markdown). */
export function globalSkillsDataDir(cwd: string): string {
  return path.join(cwd, ".data", "skills");
}

/** Legacy repo-root `skills/` (optional merge if present). */
export function legacyRepoSkillsDir(cwd: string): string {
  return path.join(cwd, "skills");
}
