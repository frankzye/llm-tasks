import fs from "node:fs/promises";
import path from "node:path";

/**
 * Copies a directory tree into `.data/skills/from-folder/` (replaces previous import).
 * Skips `.git` and `node_modules` after copy.
 */
export async function importSkillsFolderIntoData(
  cwd: string,
  absoluteSourceDir: string,
): Promise<{ dest: string }> {
  const resolved = path.resolve(absoluteSourceDir);
  const st = await fs.stat(resolved).catch(() => null);
  if (!st?.isDirectory()) {
    throw new Error("Not a directory or not accessible.");
  }

  const skillsRoot = path.join(cwd, ".data", "skills");
  const dest = path.join(skillsRoot, "from-folder");
  await fs.mkdir(skillsRoot, { recursive: true });
  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(resolved, dest, { recursive: true });
  await fs.rm(path.join(dest, ".git"), { recursive: true, force: true }).catch(
    () => undefined,
  );
  await fs
    .rm(path.join(dest, "node_modules"), { recursive: true, force: true })
    .catch(() => undefined);

  return { dest };
}
