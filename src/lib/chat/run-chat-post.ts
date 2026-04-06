import { randomUUID } from "node:crypto";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  streamText,
  tool,
  type UIMessage,
  zodSchema,
  stepCountIs,
} from "ai";

import { experimental_download } from "@/src/lib/ai-download";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { JSONSchema7 } from "json-schema";
import type { Message } from "mem0ai/oss";

import { appendA2A } from "@/src/lib/agent/a2a";
import {
  listAgentsFromDisk,
  readAgentConfig,
  sanitizeAgentId,
} from "@/src/lib/agent/agent-store";
import { autoCompactMessages } from "@/src/lib/agent/compaction";
import {
  isCliCommandAllowlisted,
  isCliCommandInAlwaysAllowList,
  runCliAllowlistedInSandbox,
} from "@/src/lib/agent/cli";
import {
  addConversationToAgentMemory,
  addExplicitMemory,
  getMemoryForAgent,
  searchMemoriesForAgent,
} from "@/src/lib/agent/mem0-service";
import { catalogIdSet, readSkillsCatalog } from "@/src/lib/agent/skills-catalog";
import { ensureSkillsIndex } from "@/src/lib/agent/skills-catalog-watcher";
import {
  filterSkillsForCatalog,
  getSkillById,
  loadSkillsMerged,
  searchSkillsHybrid,
} from "@/src/lib/agent/skills";
import { getLastUserMessageText } from "@/src/lib/agent/ui-messages";
import {
  findProviderById,
  getDefaultChatModelFromSettings,
  isAllowedChatModel,
} from "@/src/lib/chat-models";
import { consumeChatResponseToText } from "@/src/lib/chat/consume-chat-response";
import { dataRootDir } from "@/src/lib/data-root";
import { readGlobalSettings } from "@/src/lib/global-settings";
import {
  globalSkillsDataDir,
  legacyRepoSkillsDir,
} from "@/src/lib/global-skills-paths";
import { getOpenAI } from "@/src/lib/openai-provider";
import { getOllama } from "@/src/lib/ollama-provider";
import { getDeepSeek } from "@/src/lib/deepseek-provider";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(/* turbopackIgnore: true */ p);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_BASE_SYSTEM = `You are a helpful assistant.`;

async function getBaseSystem(cwd: string): Promise<string> {
  const p = path.join(cwd, "system_prompt.md");
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ p, "utf8");
    const trimmed = raw.trim();
    return trimmed || DEFAULT_BASE_SYSTEM;
  } catch {
    return DEFAULT_BASE_SYSTEM;
  }
}

const MD_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

function extractSkillResourceHints(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(MD_LINK_RE)) {
    const target = (m[1] ?? "").trim();
    if (!target) continue;
    if (/^[a-z]+:\/\//i.test(target)) continue;
    if (target.startsWith("#")) continue;
    out.push(target.replace(/\\/g, "/"));
  }
  return [...new Set(out)].slice(0, 30);
}

function safeResolveSkillResource(baseDir: string, relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, "/").trim();
  if (!normalized) return null;
  if (normalized.startsWith("/")) return null;
  if (normalized.includes("\0")) return null;
  const joined = path.resolve(baseDir, normalized);
  const rel = path.relative(baseDir, joined).replace(/\\/g, "/");
  if (rel.startsWith("../") || rel === "..") return null;
  return joined;
}

export type ChatPostBody = {
  messages: UIMessage[];
  system?: string;
  tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  model?: string;
  threadId?: string;
};

export async function runChatPost(body: ChatPostBody): Promise<Response> {
  const {
    messages,
    system,
    tools,
    model: requestedModel,
    threadId: rawThreadId,
  } = body;

  const cwd = process.cwd();
  if (!rawThreadId || typeof rawThreadId !== "string" || !rawThreadId.trim()) {
    return new Response("Not Found", { status: 404 });
  }
  if (rawThreadId.startsWith("__LOCALID_")) {
    return new Response("Not Found", { status: 404 });
  }
  const agentConfig = await readAgentConfig(cwd, rawThreadId);
  if (!agentConfig) {
    return new Response("Not Found", { status: 404 });
  }
  const agentId = agentConfig.id;
  const baseSystem = await getBaseSystem(cwd);
  const settings = await readGlobalSettings(cwd);

  const envDefault = process.env.DEFAULT_CHAT_MODEL?.trim();
  const settingsDefault = getDefaultChatModelFromSettings(settings);
  const preferredDefaultModel =
    agentConfig.modelId && isAllowedChatModel(agentConfig.modelId, settings)
      ? agentConfig.modelId
      : envDefault && isAllowedChatModel(envDefault, settings)
        ? envDefault
        : settingsDefault;
  const modelId =
    requestedModel && isAllowedChatModel(requestedModel, settings)
      ? requestedModel
      : preferredDefaultModel;
  const selectedProvider = findProviderById(
    settings,
    agentConfig.modelProviderId,
  );
  const provider = selectedProvider?.kind ?? settings.provider ?? "openai";
  const providerBaseUrl =
    selectedProvider?.baseUrl ?? settings.providerBaseUrl ?? undefined;
  const providerApiKey =
    selectedProvider?.apiKey ?? settings.providerApiKey ?? undefined;
  const model =
    provider === "ollama"
      ? getOllama({
          baseURL: providerBaseUrl,
          apiKey: providerApiKey,
        }).chat(modelId, { think: true })
      : provider === "deepseek"
        ? getDeepSeek({
            baseURL: providerBaseUrl,
            apiKey: providerApiKey,
          }).chat(modelId)
      : getOpenAI({
          baseURL: providerBaseUrl,
          apiKey: providerApiKey,
        }).chatModel(modelId);
  const globalSkillsDir = globalSkillsDataDir(cwd);
  await fs.mkdir(/* turbopackIgnore: true */ globalSkillsDir, {
    recursive: true,
  });
  await ensureSkillsIndex(cwd);
  const catalog = await readSkillsCatalog(globalSkillsDir);
  const catalogIds = catalogIdSet(catalog);
  const extraGlobalDirs: string[] = [];
  const legacy = legacyRepoSkillsDir(cwd);
  if (await pathExists(legacy) && legacy !== globalSkillsDir) {
    extraGlobalDirs.push(legacy);
  }
  const fp = settings.skillsFolderPath?.trim();
  if (fp) {
    const resolved = path.resolve(fp);
    if (await pathExists(resolved)) extraGlobalDirs.push(resolved);
  }
  const agentSkillsDir = path.join(
    dataRootDir(cwd),
    "agents",
    agentId,
    "skills",
  );
  const merged = await loadSkillsMerged(
    globalSkillsDir,
    agentSkillsDir,
    extraGlobalDirs,
  );
  const skills = filterSkillsForCatalog(
    merged,
    catalogIds,
    agentConfig.enabledSkillIds,
  );
  const catalogById = new Map((catalog?.skills ?? []).map((s) => [s.id, s] as const));
  const skillsInventory = skills
    .map((s) => {
      const cat = catalog?.skills.find((x) => x.id === s.id);
      return {
        skillId: s.id,
        name: cat?.name ?? s.title,
        description:
          cat?.description?.trim() ||
          s.body.slice(0, 220).replace(/\s+/g, " ").trim(),
      };
    })
    .sort((a, b) => a.skillId.localeCompare(b.skillId));

  const compacted = await autoCompactMessages(messages, model);

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
    baseSystem,
    agentConfig.systemPrompt,
    system,
    mem0Context.trim() ? mem0Context : undefined,
    compacted.systemAddendum,
  ]
    .filter(Boolean)
    .join("\n\n");

  const dataDir = dataRootDir(cwd);

  const result = streamText({
    model,
    messages: await convertToModelMessages(compacted.messages),
    system: mergedSystem,
    experimental_download,
    stopWhen: stepCountIs(100),
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
      find_agents: tool({
        description:
          "List all agents (chat threads) on this server with id, name, and description. Use before a2a_send to choose targetAgentId.",
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          const agents = await listAgentsFromDisk(cwd);
          return {
            agents: agents.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description?.trim() ?? "",
            })),
          };
        },
      }),
      find_skills: tool({
        description:
          "Find available skills and return both ranked matches and compact skills inventory (skillId, name, description).",
        inputSchema: zodSchema(
          z.object({
            query: z
              .string()
              .describe("Search text using task words and skill concepts.")
          }),
        ),
        execute: async ({ query }) => {
          const hits = searchSkillsHybrid(query, skills, 8);
          return {
            hits,
            skillsInventory,
          };
        },
      }),
      load_skill: tool({
        description:
          "Load the full skill document by exact skillId from find_skills.",
        inputSchema: zodSchema(
          z.object({
            skillId: z
              .string()
              .describe(
                "Exact skillId returned by find_skills (not the display name).",
              ),
          }),
        ),
        execute: async ({ skillId }) => {
          const s = getSkillById(skills, skillId);
          if (!s) return { error: `Unknown skill: ${skillId}` };
          const cat = catalogById.get(s.id);
          const skillMdPath =
            cat && path.resolve(globalSkillsDir, cat.path).replace(/\\/g, "/");
          const resourceHints = extractSkillResourceHints(s.body);
          return {
            id: s.id,
            title: s.title,
            tags: s.tags,
            skillMdPath,
            resourceHints,
            body: s.body.slice(0, 48_000),
          };
        },
      }),
      load_skill_resource: tool({
        description:
          "Load an additional file referenced by SKILL.md (progressive disclosure). Use skillId + relativePath from load_skill.resourceHints.",
        inputSchema: zodSchema(
          z.object({
            skillId: z.string(),
            relativePath: z.string(),
          }),
        ),
        execute: async ({ skillId, relativePath }) => {
          const s = getSkillById(skills, skillId);
          if (!s) return { error: `Unknown skill: ${skillId}` };
          const cat = catalogById.get(skillId);
          if (!cat) {
            return {
              error:
                "Resource loading is only supported for catalog skills under the data-root skills directory.",
            };
          }
          const skillMdAbs = path.resolve(globalSkillsDir, cat.path);
          const baseDir = path.dirname(skillMdAbs);
          const full = safeResolveSkillResource(baseDir, relativePath);
          if (!full) {
            return { error: "Invalid relativePath" };
          }
          try {
            const raw = await fs.readFile(/* turbopackIgnore: true */ full, "utf8");
            return {
              skillId,
              relativePath: relativePath.replace(/\\/g, "/"),
              body: raw.slice(0, 48_000),
            };
          } catch (e) {
            return { error: `Failed to read resource: ${String(e)}` };
          }
        },
      }),
      memory_store: tool({
        description:
          "Save a short fact to this agent's Mem0 long-term memory. Call **only** when the user clearly asks you to remember, save, or store information or messages for later—not on your own initiative.",
        inputSchema: zodSchema(
          z.object({
            content: z
              .string()
              .describe(
                "What to store: the fact, preference, or message excerpt the user asked you to remember.",
              ),
          }),
        ),
        execute: async ({ content }) => {
          if (!getMemoryForAgent(cwd, agentId)) {
            return {
              ok: false as const,
              error:
                "Mem0 requires OPENAI_API_KEY (and MEM0_ENABLED not false).",
            };
          }
          try {
            await addExplicitMemory(cwd, agentId, content);
            return { ok: true as const };
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
          "Run any shell command or cli command.",
        inputSchema: zodSchema(
          z.object({
            command: z
              .string()
              .describe("Single command; allowlisted tools run at once, others wait for user Run in the chat UI."),
          }),
        ),
        needsApproval: async ({ command }) => {
          const cmd = command.trim();
          if (isCliCommandAllowlisted(cmd)) return false;
          if (isCliCommandInAlwaysAllowList(cmd, settings.cliAlwaysAllowCommands)) {
            return false;
          }
          return true;
        },
        execute: async ({ command }) => {
          const cmd = command.trim();
          if (!cmd) {
            return { status: "error" as const, message: "empty command" };
          }
          const output = await runCliAllowlistedInSandbox(cmd, cwd, agentId);
          return { status: "completed" as const, output };
        },
      }),
      a2a_send: tool({
        description:
          "Send a message to another agent thread: runs /api/chat for that agent (same as the UI) and returns their assistant reply. Use find_agents for ids.",
        inputSchema: zodSchema(
          z.object({
            targetAgentId: z
              .string()
              .describe("Agent id from find_agents (same as thread id)."),
            message: z.string(),
            correlationId: z.string().optional(),
          }),
        ),
        execute: async ({ targetAgentId, message, correlationId }) => {
          const tid = targetAgentId.trim();
          if (!tid) {
            return { error: "targetAgentId is required" };
          }
          if (sanitizeAgentId(tid) === agentId) {
            return { error: "Cannot send A2A to yourself." };
          }
          const targetCfg = await readAgentConfig(cwd, tid);
          if (!targetCfg) {
            return { error: `Unknown agent: ${tid}` };
          }
          const msgText = message.trim();
          if (!msgText) {
            return { error: "message is empty" };
          }

          const innerBody: ChatPostBody = {
            threadId: targetCfg.id,
            messages: [
              {
                id: randomUUID(),
                role: "user",
                parts: [{ type: "text", text: msgText }],
              },
            ],
          };

          const res = await runChatPost(innerBody);
          if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            return {
              error: errBody || `Target chat failed (${res.status})`,
            };
          }

          const replyText = await consumeChatResponseToText(res.body);
          const env = await appendA2A(dataDir, {
            targetAgentId: targetCfg.id,
            message: msgText,
            correlationId,
          });

          return {
            delivered: true as const,
            targetAgentId: targetCfg.id,
            targetName: targetCfg.name,
            assistantReply: replyText.slice(0, 48_000),
            inboxMessageId: env.id,
            note: "Ran the target agent via the same /api/chat pipeline; envelope appended to a2a-inbox.jsonl.",
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
