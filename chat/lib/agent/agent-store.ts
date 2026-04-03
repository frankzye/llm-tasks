import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { generateAgentName } from "@/lib/agent-name";

/** On-disk agent (one per chat thread). Used for config + per-agent skills. */
export type AgentConfig = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Extra system instructions (merged after the app base prompt). */
  systemPrompt?: string;
  /** Maps to AI SDK `maxOutputTokens` when set. */
  maxTokens?: number;
  /** Selected chat model for this agent thread. */
  modelId?: string;
  /** Selected model provider id for this agent thread. */
  modelProviderId?: string;
  /** Last git URL used for skills sync (https only). */
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  /**
   * When set, only these ids from `.data/skills/skills.json` are available to find_skills/load_skill.
   * Omit for all catalog skills. Empty array = no global catalog skills (agent-local skills still apply).
   */
  enabledSkillIds?: string[];
};

export function normalizeAgentConfig(
  raw: unknown,
  fallbackId: string,
): AgentConfig {
  const o =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const maxRaw = o.maxTokens;
  const maxTokens =
    typeof maxRaw === "number" &&
    Number.isFinite(maxRaw) &&
    maxRaw > 0 &&
    maxRaw <= 128_000
      ? Math.floor(maxRaw)
      : undefined;
  return {
    id: typeof o.id === "string" ? o.id : fallbackId,
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Agent",
    createdAt:
      typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    systemPrompt:
      typeof o.systemPrompt === "string" ? o.systemPrompt : undefined,
    maxTokens,
    modelId: typeof o.modelId === "string" ? o.modelId.trim() || undefined : undefined,
    modelProviderId:
      typeof o.modelProviderId === "string"
        ? o.modelProviderId.trim() || undefined
        : undefined,
    skillsGitUrl:
      typeof o.skillsGitUrl === "string" ? o.skillsGitUrl : undefined,
    skillsGitLastSyncedAt:
      typeof o.skillsGitLastSyncedAt === "string"
        ? o.skillsGitLastSyncedAt
        : undefined,
    ...(() => {
      if (!("enabledSkillIds" in o) || o.enabledSkillIds === null) {
        return {} as { enabledSkillIds?: string[] };
      }
      if (Array.isArray(o.enabledSkillIds)) {
        const ids = o.enabledSkillIds.filter((x) => typeof x === "string");
        return { enabledSkillIds: ids };
      }
      return {} as { enabledSkillIds?: string[] };
    })(),
  };
}

export function agentsRoot(cwd = process.cwd()): string {
  return path.join(cwd, ".data", "agents");
}

/** Safe directory name for agent storage (thread ids are usually UUIDs). */
export function sanitizeAgentId(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256);
  return s.length > 0 ? s : "default";
}

export function agentDataDir(cwd: string, agentId: string): string {
  return path.join(agentsRoot(cwd), sanitizeAgentId(agentId));
}

export function agentSkillsDir(cwd: string, agentId: string): string {
  return path.join(agentDataDir(cwd, agentId), "skills");
}

export async function readAgentConfig(
  cwd: string,
  rawAgentId: string,
): Promise<AgentConfig | null> {
  const id = sanitizeAgentId(rawAgentId);
  const configPath = path.join(agentDataDir(cwd, id), "config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return normalizeAgentConfig(JSON.parse(raw) as unknown, id);
  } catch {
    return null;
  }
}

export async function writeAgentConfig(
  cwd: string,
  config: AgentConfig,
): Promise<void> {
  const id = sanitizeAgentId(config.id);
  const dir = agentDataDir(cwd, id);
  await fs.mkdir(path.join(dir, "skills"), { recursive: true });
  const configPath = path.join(dir, "config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Ensures `.data/agents/<id>/config.json` and `skills/` exist.
 * Each thread maps to one agent directory.
 */
export async function ensureAgent(
  cwd: string,
  rawAgentId: string,
): Promise<{ dir: string; config: AgentConfig }> {
  const id = sanitizeAgentId(rawAgentId);
  const dir = agentDataDir(cwd, id);
  await fs.mkdir(path.join(dir, "skills"), { recursive: true });

  const configPath = path.join(dir, "config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const config = normalizeAgentConfig(JSON.parse(raw) as unknown, id);
    return { dir, config };
  } catch {
    const now = new Date().toISOString();
    const config: AgentConfig = {
      id,
      name: "Agent",
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    return { dir, config };
  }
}

/** All agents on disk (one folder per id under `.data/agents/`). */
export async function listAgentsFromDisk(cwd: string): Promise<AgentConfig[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(agentsRoot(cwd));
  } catch {
    return [];
  }
  const out: AgentConfig[] = [];
  for (const dir of names) {
    const configPath = path.join(agentsRoot(cwd), dir, "config.json");
    try {
      const raw = await fs.readFile(configPath, "utf8");
      out.push(
        normalizeAgentConfig(JSON.parse(raw) as unknown, sanitizeAgentId(dir)),
      );
    } catch {
      /* skip incomplete dirs */
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function createNewAgent(
  cwd: string,
  name = generateAgentName(),
): Promise<AgentConfig> {
  const id = randomUUID();
  await ensureAgent(cwd, id);
  const configPath = path.join(agentDataDir(cwd, id), "config.json");
  const raw = await fs.readFile(configPath, "utf8");
  const config = normalizeAgentConfig(JSON.parse(raw) as unknown, id);
  const now = new Date().toISOString();
  const next: AgentConfig = {
    ...config,
    name: name.slice(0, 256),
    updatedAt: now,
  };
  await fs.writeFile(configPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export type AgentConfigPatch = {
  name?: string;
  systemPrompt?: string | null;
  maxTokens?: number | null;
  modelId?: string | null;
  modelProviderId?: string | null;
  skillsGitUrl?: string | null;
  skillsGitLastSyncedAt?: string;
  /** `null` clears restriction (use all catalog skills). */
  enabledSkillIds?: string[] | null;
};

export async function updateAgentConfigPartial(
  cwd: string,
  rawAgentId: string,
  patch: AgentConfigPatch,
): Promise<AgentConfig | null> {
  const existing = await readAgentConfig(cwd, rawAgentId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const next: AgentConfig = { ...existing, updatedAt: now };

  if (patch.name !== undefined) {
    next.name = patch.name.trim().slice(0, 256) || existing.name;
  }
  if ("systemPrompt" in patch) {
    const s = patch.systemPrompt;
    next.systemPrompt =
      s === null || s === undefined || String(s).trim() === ""
        ? undefined
        : String(s);
  }
  if ("maxTokens" in patch) {
    const m = patch.maxTokens;
    if (m === null || m === undefined || m === 0) {
      delete next.maxTokens;
    } else if (typeof m === "number" && m > 0 && m <= 128_000) {
      next.maxTokens = Math.floor(m);
    }
  }
  if ("modelId" in patch) {
    const m = patch.modelId;
    next.modelId =
      m === null || m === undefined || String(m).trim() === ""
        ? undefined
        : String(m).trim();
  }
  if ("modelProviderId" in patch) {
    const p = patch.modelProviderId;
    next.modelProviderId =
      p === null || p === undefined || String(p).trim() === ""
        ? undefined
        : String(p).trim();
  }
  if ("skillsGitUrl" in patch) {
    const u = patch.skillsGitUrl;
    next.skillsGitUrl =
      u === null || u === undefined || String(u).trim() === ""
        ? undefined
        : String(u).trim();
  }
  if (patch.skillsGitLastSyncedAt !== undefined) {
    next.skillsGitLastSyncedAt = patch.skillsGitLastSyncedAt;
  }
  if ("enabledSkillIds" in patch) {
    if (patch.enabledSkillIds === null) {
      delete next.enabledSkillIds;
    } else if (Array.isArray(patch.enabledSkillIds)) {
      next.enabledSkillIds = patch.enabledSkillIds.filter(
        (x) => typeof x === "string",
      );
    }
  }

  await writeAgentConfig(cwd, next);
  return next;
}

export async function updateAgentNameOnDisk(
  cwd: string,
  rawAgentId: string,
  name: string,
): Promise<AgentConfig | null> {
  return updateAgentConfigPartial(cwd, rawAgentId, { name });
}

export async function deleteAgentDir(cwd: string, rawAgentId: string): Promise<boolean> {
  const id = sanitizeAgentId(rawAgentId);
  const dir = agentDataDir(cwd, id);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
