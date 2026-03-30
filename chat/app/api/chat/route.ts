import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  streamText,
  tool,
  type UIMessage,
  zodSchema,
  stepCountIs,
} from "ai";

import { experimental_download } from "@/lib/ai-download";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { JSONSchema7 } from "json-schema";
import type { Message } from "mem0ai/oss";

import { appendA2A } from "@/lib/agent/a2a";
import { ensureAgent } from "@/lib/agent/agent-store";
import { autoCompactMessages } from "@/lib/agent/compaction";
import { runCliAllowlisted } from "@/lib/agent/cli";
import {
  addConversationToAgentMemory,
  addExplicitMemory,
  getMemoryForAgent,
  searchMemoriesForAgent,
} from "@/lib/agent/mem0-service";
import {
  getSkillById,
  loadSkillsMerged,
  searchSkillsHybrid,
} from "@/lib/agent/skills";
import { getLastUserMessageText } from "@/lib/agent/ui-messages";
import { DEFAULT_CHAT_MODEL, isAllowedChatModel } from "@/lib/chat-models";
import { readGlobalSettings } from "@/lib/global-settings";
import {
  globalSkillsDataDir,
  legacyRepoSkillsDir,
} from "@/lib/global-skills-paths";
import { getOpenAI } from "@/lib/openai-provider";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export const maxDuration = 60;

const BASE_SYSTEM = `You are an agent assistant with tools for skills (RAG), Mem0 long-term memory, a safe CLI, and agent-to-agent (A2A) messaging.
Global skills live under .data/skills/ (Settings: Git sync, folder import, optional extra path). Each agent also has .data/agents/<threadId>/skills/.
Use find_skills before load_skill when you need procedural knowledge. Store durable user facts with memory_store (Mem0).`;

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
    model: requestedModel,
    threadId: rawThreadId,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
    model?: string;
    threadId?: string;
  } = await req.json();

  const cwd = process.cwd();
  const { config: agentConfig } = await ensureAgent(cwd, rawThreadId ?? "default");
  const agentId = agentConfig.id;

  const envDefault = process.env.DEFAULT_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  const modelId =
    requestedModel && isAllowedChatModel(requestedModel)
      ? requestedModel
      : envDefault;
  const openai = getOpenAI();
  // Use Chat Completions (`/v1/chat/completions`). Ollama and most gateways do not support
  // the default `openai(modelId)` Responses API (`/v1/responses`, item_reference types).
  const model = openai.chat(modelId);
  const settings = await readGlobalSettings(cwd);
  const globalSkillsDir = globalSkillsDataDir(cwd);
  await fs.mkdir(globalSkillsDir, { recursive: true });
  const extraGlobalDirs: string[] = [];
  const legacy = legacyRepoSkillsDir(cwd);
  if (await pathExists(legacy)) extraGlobalDirs.push(legacy);
  const fp = settings.skillsFolderPath?.trim();
  if (fp) {
    const resolved = path.resolve(fp);
    if (await pathExists(resolved)) extraGlobalDirs.push(resolved);
  }
  const agentSkillsDir = path.join(cwd, ".data", "agents", agentId, "skills");
  const skills = await loadSkillsMerged(
    globalSkillsDir,
    agentSkillsDir,
    extraGlobalDirs,
  );

  const compacted = await autoCompactMessages(messages, model, {
    maxChars: 14_000,
    keepLast: 8,
  });

  const lastUserText = getLastUserMessageText(messages);
  let mem0Context = "";
  if (lastUserText?.trim() && getMemoryForAgent(cwd, agentId)) {
    try {
      const hits = await searchMemoriesForAgent(cwd, agentId, lastUserText, 8);
      if (hits.length > 0) {
        mem0Context =
          "Relevant long-term memory (Mem0):\n" +
          hits.map((h, i) => `${i + 1}. ${h.memory}`).join("\n");
      }
    } catch (e) {
      console.error("[mem0] search failed", e);
    }
  }

  const mergedSystem = [
    BASE_SYSTEM,
    agentConfig.systemPrompt,
    mem0Context,
    system,
    compacted.systemAddendum,
  ]
    .filter(Boolean)
    .join("\n\n");

  const dataDir = path.join(cwd, ".data");

  const result = streamText({
    model,
    messages: await convertToModelMessages(compacted.messages),
    system: mergedSystem,
    experimental_download,
    stopWhen: stepCountIs(12),
    ...(typeof agentConfig.maxTokens === "number" && agentConfig.maxTokens > 0
      ? { maxOutputTokens: agentConfig.maxTokens }
      : {}),
    onFinish: async ({ steps, text }) => {
      const userText = getLastUserMessageText(messages);
      if (!userText?.trim()) return;
      const assistantText =
        (steps?.map((s) => s.text).join("\n") || text || "").trim();
      if (!assistantText) return;
      const pair: Message[] = [
        { role: "user", content: userText.slice(0, 12_000) },
        { role: "assistant", content: assistantText.slice(0, 48_000) },
      ];
      try {
        await addConversationToAgentMemory(cwd, agentId, pair);
      } catch (e) {
        console.error("[mem0] add conversation failed", e);
      }
    },
    tools: {
      ...frontendTools(tools ?? {}),
      find_skills: tool({
        description:
          "Hybrid search (BM25 + bag-of-words similarity) over global .data/skills/, optional legacy repo skills/ and optional Settings path, then this agent's .data/agents/<id>/skills/ (agent wins on duplicate ids).",
        inputSchema: zodSchema(
          z.object({
            query: z.string(),
            limit: z.number().min(1).max(20).optional(),
          }),
        ),
        execute: async ({ query, limit }) => {
          const hits = searchSkillsHybrid(query, skills, limit ?? 8);
          return { hits };
        },
      }),
      load_skill: tool({
        description: "Load full skill document body by id (from find_skills).",
        inputSchema: zodSchema(
          z.object({
            skillId: z.string(),
          }),
        ),
        execute: async ({ skillId }) => {
          const s = getSkillById(skills, skillId);
          if (!s) return { error: `Unknown skill: ${skillId}` };
          return {
            id: s.id,
            title: s.title,
            tags: s.tags,
            body: s.body.slice(0, 48_000),
          };
        },
      }),
      memory_store: tool({
        description:
          "Persist a fact in this agent's Mem0 long-term memory (semantic retrieval on later turns).",
        inputSchema: zodSchema(
          z.object({
            key: z.string(),
            value: z.string(),
          }),
        ),
        execute: async ({ key, value }) => {
          if (!getMemoryForAgent(cwd, agentId)) {
            return {
              ok: false as const,
              error:
                "Mem0 requires OPENAI_API_KEY (and MEM0_ENABLED not false).",
            };
          }
          try {
            await addExplicitMemory(
              cwd,
              agentId,
              `${key}: ${value}`,
            );
            return { ok: true as const, key };
          } catch (e) {
            return { ok: false as const, error: String(e) };
          }
        },
      }),
      memory_recall: tool({
        description:
          "Search this agent's Mem0 memories by meaning and keywords (not just exact key match).",
        inputSchema: zodSchema(
          z.object({
            query: z.string(),
            limit: z.number().min(1).max(20).optional(),
          }),
        ),
        execute: async ({ query, limit }) => {
          if (!getMemoryForAgent(cwd, agentId)) {
            return { entries: [] as { key: string; value: string; updatedAt: string }[] };
          }
          try {
            const rows = await searchMemoriesForAgent(
              cwd,
              agentId,
              query,
              limit ?? 8,
            );
            return {
              entries: rows.map((r, i) => ({
                key: `mem_${i}`,
                value: r.memory,
                updatedAt: new Date().toISOString(),
              })),
            };
          } catch (e) {
            console.error("[mem0] recall failed", e);
            return { entries: [], error: String(e) };
          }
        },
      }),
      cli_run: tool({
        description:
          "Run a allowlisted shell command (no shell metacharacters). Allowed: pwd, echo, date, uname, whoami, hostname, wc, ls.",
        inputSchema: zodSchema(
          z.object({
            command: z.string(),
          }),
        ),
        execute: async ({ command }) => {
          const out = await runCliAllowlisted(command, process.cwd());
          return { output: out };
        },
      }),
      a2a_send: tool({
        description:
          "Send a message to another agent via A2A (persisted to local inbox JSONL for integration).",
        inputSchema: zodSchema(
          z.object({
            targetAgentId: z.string(),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
        ),
        execute: async ({ targetAgentId, message, correlationId }) => {
          const env = await appendA2A(dataDir, {
            targetAgentId,
            message,
            correlationId,
          });
          return {
            delivered: true as const,
            messageId: env.id,
            note: "Message appended to a2a-inbox.jsonl under .data/",
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
