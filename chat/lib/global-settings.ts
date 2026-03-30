import fs from "node:fs/promises";
import path from "node:path";

export type GlobalSettings = {
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  /** Absolute path on the server; markdown under this tree is merged at chat time. */
  skillsFolderPath?: string | null;
};

export function globalSettingsFilePath(cwd: string): string {
  return path.join(cwd, ".data", "global-settings.json");
}

export async function readGlobalSettings(cwd: string): Promise<GlobalSettings> {
  try {
    const raw = await fs.readFile(globalSettingsFilePath(cwd), "utf8");
    const j = JSON.parse(raw) as unknown;
    if (typeof j !== "object" || j === null) return {};
    return j as GlobalSettings;
  } catch {
    return {};
  }
}

export async function writeGlobalSettings(
  cwd: string,
  next: GlobalSettings,
): Promise<void> {
  const p = globalSettingsFilePath(cwd);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(next, null, 2), "utf8");
}

export async function patchGlobalSettings(
  cwd: string,
  patch: Partial<GlobalSettings>,
): Promise<GlobalSettings> {
  const cur = await readGlobalSettings(cwd);
  const merged: GlobalSettings = { ...cur, ...patch };
  await writeGlobalSettings(cwd, merged);
  return merged;
}
