import fs from "node:fs/promises";
import path from "node:path";

export type GlobalSettings = {
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  /** Absolute path on the server; markdown under this tree is merged at chat time. */
  skillsFolderPath?: string | null;
  /** Allowed chat model ids shown in UI + accepted by API. */
  chatModels?: string[];
  /** Default chat model id when agent/user does not select one. */
  defaultChatModel?: string;
  /** Chat provider used by /api/chat. */
  provider?: "openai" | "ollama" | "deepseek";
  /** Provider API root/base URL. */
  providerBaseUrl?: string | null;
  /** Provider API key/token. */
  providerApiKey?: string | null;
};

export function globalSettingsFilePath(cwd: string): string {
  return path.join(cwd, ".data", "global-settings.json");
}

export async function readGlobalSettings(cwd: string): Promise<GlobalSettings> {
  try {
    const raw = await fs.readFile(globalSettingsFilePath(cwd), "utf8");
    const j = JSON.parse(raw) as unknown;
    if (typeof j !== "object" || j === null) return {};
    const o = j as Record<string, unknown>;
    const out: GlobalSettings = {};
    if (typeof o.skillsGitUrl === "string") out.skillsGitUrl = o.skillsGitUrl;
    if (typeof o.skillsGitLastSyncedAt === "string") {
      out.skillsGitLastSyncedAt = o.skillsGitLastSyncedAt;
    }
    if (o.skillsFolderPath === null || typeof o.skillsFolderPath === "string") {
      out.skillsFolderPath = o.skillsFolderPath;
    }
    if (Array.isArray(o.chatModels)) {
      const models = o.chatModels
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean);
      if (models.length > 0) out.chatModels = [...new Set(models)];
    }
    if (typeof o.defaultChatModel === "string" && o.defaultChatModel.trim()) {
      out.defaultChatModel = o.defaultChatModel.trim();
    }
    if (o.provider === "openai" || o.provider === "ollama" || o.provider === "deepseek") {
      out.provider = o.provider;
    }
    if (o.providerBaseUrl === null || typeof o.providerBaseUrl === "string") {
      out.providerBaseUrl =
        typeof o.providerBaseUrl === "string" ? o.providerBaseUrl.trim() : null;
    }
    if (o.providerApiKey === null || typeof o.providerApiKey === "string") {
      out.providerApiKey =
        typeof o.providerApiKey === "string" ? o.providerApiKey.trim() : null;
    }
    return out;
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
