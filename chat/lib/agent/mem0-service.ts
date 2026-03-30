import path from "node:path";
import { Memory, type Message } from "mem0ai/oss";

import { agentDataDir, sanitizeAgentId } from "@/lib/agent/agent-store";

/** One Mem0 client per agent; SQLite + vectors live under `.data/agents/<agentId>/mem0/`. */
const memoryByAgentId = new Map<string, Memory>();

export function agentMem0Dir(cwd: string, rawAgentId: string): string {
  return path.join(agentDataDir(cwd, rawAgentId), "mem0");
}

function mem0Enabled(): boolean {
  return process.env.MEM0_ENABLED !== "false" && !!process.env.OPENAI_API_KEY?.trim();
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

function buildMemoryForAgent(cwd: string, sanitizedId: string): Memory {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const root = agentMem0Dir(cwd, sanitizedId);
  const dim = parseEmbeddingDim();

  return new Memory({
    version: "v1.1",
    historyDbPath: path.join(root, "history.db"),
    embedder: {
      provider: "openai",
      config: {
        apiKey,
        model:
          process.env.MEM0_EMBED_MODEL ??
          "text-embedding-3-small",
        ...(dim ? { embeddingDims: dim } : {}),
        ...(baseURL ? { baseURL } : {}),
      },
    },
    vectorStore: {
      provider: "memory",
      config: {
        collectionName: "memories",
        // Omit dimension to let Mem0 probe the embedder, or set MEM0_EMBEDDING_DIM to match your model.
        ...(dim ? { dimension: dim } : {}),
        dbPath: path.join(root, "vector_store.db"),
      },
    },
    llm: {
      provider: "openai",
      config: {
        apiKey,
        model:
          process.env.MEM0_LLM_MODEL ??
          "gpt-4.1-mini-2025-04-14",
        ...(baseURL ? { baseURL } : {}),
      },
    },
  });
}

/**
 * [Mem0](https://github.com/mem0ai/mem0) OSS client for this agent only (isolated DB files).
 */
export function getMemoryForAgent(
  cwd = process.cwd(),
  rawAgentId: string,
): Memory | null {
  if (!mem0Enabled()) return null;
  const id = sanitizeAgentId(rawAgentId);
  let m = memoryByAgentId.get(id);
  if (!m) {
    m = buildMemoryForAgent(cwd, id);
    memoryByAgentId.set(id, m);
  }
  return m;
}

export async function searchMemoriesForAgent(
  cwd: string,
  rawAgentId: string,
  query: string,
  limit: number,
): Promise<{ memory: string; score?: number }[]> {
  const m = getMemoryForAgent(cwd, rawAgentId);
  if (!m || !query.trim()) return [];
  const agentId = sanitizeAgentId(rawAgentId);
  const res = await m.search(query, { agentId, limit });
  return res.results.map((r) => ({ memory: r.memory, score: r.score }));
}

export async function addExplicitMemory(
  cwd: string,
  rawAgentId: string,
  text: string,
): Promise<void> {
  const m = getMemoryForAgent(cwd, rawAgentId);
  if (!m) throw new Error("Mem0 is disabled (set OPENAI_API_KEY and MEM0_ENABLED).");
  const agentId = sanitizeAgentId(rawAgentId);
  const messages: Message[] = [{ role: "user", content: text }];
  await m.add(messages, { agentId, infer: mem0Infer() });
}

export async function addConversationToAgentMemory(
  cwd: string,
  rawAgentId: string,
  messages: Message[],
): Promise<void> {
  const m = getMemoryForAgent(cwd, rawAgentId);
  if (!m || messages.length === 0) return;
  const agentId = sanitizeAgentId(rawAgentId);
  await m.add(messages, { agentId, infer: mem0Infer() });
}
