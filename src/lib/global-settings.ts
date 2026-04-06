import fs from "node:fs/promises";
import path from "node:path";

import { normalizeCliAlwaysAllowList } from "./agent/cli";
import { dataRootDir } from "./data-root";

export type ProviderKind = "openai" | "ollama" | "deepseek";

export type ModelProviderConfig = {
  /** Unique id used by agent selection (e.g. "openai-main"). */
  id: string;
  kind: ProviderKind;
  baseUrl?: string | null;
  apiKey?: string | null;
  models: string[];
};

export type GlobalSettings = {
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  /** Last zip URL used for skills install from URL. */
  skillsZipUrl?: string;
  skillsZipLastImportedAt?: string;
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
  /** Multi-provider model configuration (preferred over legacy fields). */
  modelProviders?: ModelProviderConfig[];
  /** Default provider id for chat model fallback. */
  defaultChatProvider?: string;
  /**
   * CLI program names (first token, e.g. `npm` for `npm run dev`) that skip cli_run approval.
   * Managed from the chat CLI Run tool UI ("always allow").
   */
  cliAlwaysAllowCommands?: string[];
  /**
   * Mem0 long-term memory: OpenAI-compatible API key (overrides `OPENAI_API_KEY` when set).
   */
  mem0OpenaiApiKey?: string | null;
  /**
   * Mem0: API base URL for embedder + LLM (overrides `OPENAI_BASE_URL`).
   */
  mem0OpenaiBaseUrl?: string | null;
  /**
   * Mem0 internal LLM model id (overrides `MEM0_LLM_MODEL`).
   */
  mem0LlmModel?: string | null;
  /**
   * Mem0 embedding model id (overrides `MEM0_EMBED_MODEL`).
   */
  mem0EmbedModel?: string | null;
};

export function globalSettingsFilePath(cwd: string): string {
  return path.join(dataRootDir(cwd), "global-settings.json");
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
    if (typeof o.skillsZipUrl === "string") out.skillsZipUrl = o.skillsZipUrl;
    if (typeof o.skillsZipLastImportedAt === "string") {
      out.skillsZipLastImportedAt = o.skillsZipLastImportedAt;
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
    if (Array.isArray(o.modelProviders)) {
      const providers: ModelProviderConfig[] = [];
      for (const row of o.modelProviders) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        if (
          typeof r.id !== "string" ||
          !r.id.trim() ||
          (r.kind !== "openai" && r.kind !== "ollama" && r.kind !== "deepseek")
        ) {
          continue;
        }
        const models = Array.isArray(r.models)
          ? r.models
              .filter((x): x is string => typeof x === "string")
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
        providers.push({
          id: r.id.trim(),
          kind: r.kind,
          baseUrl:
            r.baseUrl === null || typeof r.baseUrl === "string"
              ? (typeof r.baseUrl === "string" ? r.baseUrl.trim() : null)
              : null,
          apiKey:
            r.apiKey === null || typeof r.apiKey === "string"
              ? (typeof r.apiKey === "string" ? r.apiKey.trim() : null)
              : null,
          models: [...new Set(models)],
        });
      }
      if (providers.length > 0) out.modelProviders = providers;
    }
    if (typeof o.defaultChatProvider === "string" && o.defaultChatProvider.trim()) {
      out.defaultChatProvider = o.defaultChatProvider.trim();
    }
    if (Array.isArray(o.cliAlwaysAllowCommands)) {
      const cmds = o.cliAlwaysAllowCommands.filter(
        (x): x is string => typeof x === "string",
      );
      out.cliAlwaysAllowCommands = normalizeCliAlwaysAllowList(cmds);
    }
    if (o.mem0OpenaiApiKey === null || typeof o.mem0OpenaiApiKey === "string") {
      out.mem0OpenaiApiKey =
        typeof o.mem0OpenaiApiKey === "string"
          ? o.mem0OpenaiApiKey.trim() || null
          : null;
    }
    if (o.mem0OpenaiBaseUrl === null || typeof o.mem0OpenaiBaseUrl === "string") {
      out.mem0OpenaiBaseUrl =
        typeof o.mem0OpenaiBaseUrl === "string"
          ? o.mem0OpenaiBaseUrl.trim() || null
          : null;
    }
    if (o.mem0LlmModel === null || typeof o.mem0LlmModel === "string") {
      out.mem0LlmModel =
        typeof o.mem0LlmModel === "string"
          ? o.mem0LlmModel.trim() || null
          : null;
    }
    if (o.mem0EmbedModel === null || typeof o.mem0EmbedModel === "string") {
      out.mem0EmbedModel =
        typeof o.mem0EmbedModel === "string"
          ? o.mem0EmbedModel.trim() || null
          : null;
    }
    if (!out.modelProviders || out.modelProviders.length === 0) {
      const kind = out.provider ?? "openai";
      const models = out.chatModels ?? ["qwen3.5:0.8b"];
      out.modelProviders = [
        {
          id: kind,
          kind,
          baseUrl: out.providerBaseUrl ?? null,
          apiKey: out.providerApiKey ?? null,
          models,
        },
      ];
      out.defaultChatProvider = kind;
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
