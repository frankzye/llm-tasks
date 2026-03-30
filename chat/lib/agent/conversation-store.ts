import fs from "node:fs/promises";
import path from "node:path";

import type { UIMessage } from "ai";

import { agentDataDir, sanitizeAgentId } from "@/lib/agent/agent-store";

export type StoredConversation = {
  messages: UIMessage[];
  updatedAt: string;
};

function conversationPath(cwd: string, rawAgentId: string): string {
  const id = sanitizeAgentId(rawAgentId);
  return path.join(agentDataDir(cwd, id), "conversation.json");
}

export async function readConversationMessages(
  cwd: string,
  rawAgentId: string,
): Promise<UIMessage[]> {
  const p = conversationPath(cwd, rawAgentId);
  try {
    const raw = await fs.readFile(p, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (
      typeof j === "object" &&
      j !== null &&
      Array.isArray((j as StoredConversation).messages)
    ) {
      return (j as StoredConversation).messages as UIMessage[];
    }
  } catch {
    /* missing or invalid */
  }
  return [];
}

export async function writeConversationMessages(
  cwd: string,
  rawAgentId: string,
  messages: UIMessage[],
): Promise<void> {
  const id = sanitizeAgentId(rawAgentId);
  const dir = agentDataDir(cwd, id);
  await fs.mkdir(dir, { recursive: true });
  const payload: StoredConversation = {
    messages,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(dir, "conversation.json"),
    JSON.stringify(payload),
    "utf8",
  );
}
