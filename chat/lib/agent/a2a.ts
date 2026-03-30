import fs from "node:fs/promises";
import path from "node:path";

export type A2AEnvelope = {
  id: string;
  ts: string;
  targetAgentId: string;
  message: string;
  correlationId?: string;
};

export async function appendA2A(dataDir: string, env: Omit<A2AEnvelope, "id" | "ts">): Promise<A2AEnvelope> {
  const p = path.join(dataDir, "a2a-inbox.jsonl");
  await fs.mkdir(path.dirname(p), { recursive: true });
  const full: A2AEnvelope = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...env,
  };
  await fs.appendFile(p, `${JSON.stringify(full)}\n`, "utf8");
  return full;
}
