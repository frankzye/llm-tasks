import path from "node:path";
import { Memory, type Message } from "mem0ai/oss";

import { agentDataDir, sanitizeAgentId } from "@/src/lib/agent/agent-store";
import type { GlobalSettings } from "@/src/lib/global-settings";

/** One Mem0 client per agent + config signature; SQLite + vectors under `.data/agents/<agentId>/mem0/`. */
const memoryByAgentId = new Map<string, Memory>();

export function agentMem0Dir(cwd: string, rawAgentId: string): string {
  return path.join(agentDataDir(cwd, rawAgentId), "mem0");
}

/**
 * Resolves Mem0 OpenAI-compatible settings: saved global settings override env
 * (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MEM0_LLM_MODEL`, `MEM0_EMBED_MODEL`).
 */
export function resolveMem0OpenAIConfig(settings: GlobalSettings): {
  apiKey: string;
  baseURL?: string;
  llmModel: string;
  embedModel: string;
} {
  const apiKey =
    settings.mem0OpenaiApiKey?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const baseUrlRaw =
    settings.mem0OpenaiBaseUrl?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "";
  const baseURL = baseUrlRaw || undefined;
  const llmModel =
    settings.mem0LlmModel?.trim() ||
    process.env.MEM0_LLM_MODEL?.trim() ||
    "gpt-4.1-mini-2025-04-14";
  const embedModel =
    settings.mem0EmbedModel?.trim() ||
    process.env.MEM0_EMBED_MODEL?.trim() ||
    "text-embedding-3-small";
  return { apiKey, baseURL, llmModel, embedModel };
}

function mem0ConfigSignature(settings: GlobalSettings): string {
  const c = resolveMem0OpenAIConfig(settings);
  return `${c.apiKey}|${c.baseURL ?? ""}|${c.llmModel}|${c.embedModel}`;
}

export function mem0EnabledForSettings(settings: GlobalSettings): boolean {
  return (
    process.env.MEM0_ENABLED !== "false" &&
    !!resolveMem0OpenAIConfig(settings).apiKey
  );
}

/**
 * Mem0 `add(..., { infer: true })` uses an internal LLM + JSON parsing (OpenAI-style).
 * Set `MEM0_INFER=true` only if that LLM supports reliable `json_object` output.
 * Default is `false`: embed raw text per message (works with Ollama).
 */
function mem0Infer(): boolean {
  return process.env.MEM0_INFER === "true";
}

/** Must match the embedding model (e.g. 1024 for many Ollama models, 1536 for text-embedding-3-small). */
function parseEmbeddingDim(): number | undefined {
  const raw = process.env.MEM0_EMBEDDING_DIM?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildMemoryForAgent(
  cwd: string,
  sanitizedId: string,
  settings: GlobalSettings,
): Memory {
  const { apiKey, baseURL, llmModel, embedModel } =
    resolveMem0OpenAIConfig(settings);
  const root = agentMem0Dir(cwd, sanitizedId);
  const dim = parseEmbeddingDim();

  return new Memory({
    version: "v1.1",
    historyDbPath: path.join(root, "history.db"),
    embedder: {
      provider: "openai",
      config: {
        apiKey,
        model: embedModel,
        ...(dim ? { embeddingDims: dim } : {}),
        ...(baseURL ? { baseURL } : {}),
      },
    },
    vectorStore: {
      provider: "memory",
      config: {
        collectionName: "memories",
        ...(dim ? { dimension: dim } : {}),
        dbPath: path.join(root, "vector_store.db"),
      },
    },
    llm: {
      provider: "openai",
      config: {
        apiKey,
        model: llmModel,
        ...(baseURL ? { baseURL } : {}),
      },
    },
  });
}

/**
 * [Mem0](https://github.com/mem0ai/mem0) OSS client for this agent only (isolated DB files).
 */
export function getMemoryForAgent(
  cwd: string,
  rawAgentId: string,
  settings: GlobalSettings,
): Memory | null {
  if (!mem0EnabledForSettings(settings)) return null;
  const id = sanitizeAgentId(rawAgentId);
  const sig = mem0ConfigSignature(settings);
  const key = `${id}|${sig}`;
  let m = memoryByAgentId.get(key);
  if (!m) {
    for (const k of [...memoryByAgentId.keys()]) {
      if (k.startsWith(`${id}|`)) memoryByAgentId.delete(k);
    }
    m = buildMemoryForAgent(cwd, id, settings);
    memoryByAgentId.set(key, m);
  }
  return m;
}

export async function searchMemoriesForAgent(
  cwd: string,
  rawAgentId: string,
  query: string,
  limit: number,
  settings: GlobalSettings,
): Promise<{ memory: string; score?: number }[]> {
  const m = getMemoryForAgent(cwd, rawAgentId, settings);
  if (!m || !query.trim()) return [];
  const agentId = sanitizeAgentId(rawAgentId);
  const res = await m.search(query, { agentId, limit });
  return res.results.map((r) => ({ memory: r.memory, score: r.score }));
}

export async function addExplicitMemory(
  cwd: string,
  rawAgentId: string,
  text: string,
  settings: GlobalSettings,
): Promise<void> {
  const m = getMemoryForAgent(cwd, rawAgentId, settings);
  if (!m) {
    throw new Error(
      "Mem0 is disabled (set API key in Settings → Mem0 or OPENAI_API_KEY, and MEM0_ENABLED not false).",
    );
  }
  const agentId = sanitizeAgentId(rawAgentId);
  const messages: Message[] = [{ role: "user", content: text }];
  await m.add(messages, { agentId, infer: mem0Infer() });
}

export async function addConversationToAgentMemory(
  cwd: string,
  rawAgentId: string,
  messages: Message[],
  settings: GlobalSettings,
): Promise<void> {
  const m = getMemoryForAgent(cwd, rawAgentId, settings);
  if (!m || messages.length === 0) return;
  const agentId = sanitizeAgentId(rawAgentId);
  await m.add(messages, { agentId, infer: mem0Infer() });
}
