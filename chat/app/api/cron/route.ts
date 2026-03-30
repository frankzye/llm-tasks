import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

import { agentsRoot } from "@/lib/agent/agent-store";

/**
 * External cron / scheduler hook (e.g. system crontab hitting this URL).
 * Protect with CRON_SECRET in production.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (secret && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cwd = process.cwd();
  const dataDir = path.join(cwd, ".data");
  const inbox = path.join(dataDir, "a2a-inbox.jsonl");
  let inboxLines = 0;
  try {
    const raw = await fs.readFile(inbox, "utf8");
    inboxLines = raw.split("\n").filter(Boolean).length;
  } catch {
    inboxLines = 0;
  }

  let agentDirs = 0;
  try {
    const names = await fs.readdir(agentsRoot(cwd));
    agentDirs = names.length;
  } catch {
    agentDirs = 0;
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    agentDirs,
    mem0PerAgent: "each agent stores Mem0 under .data/agents/<agentId>/mem0/",
    a2aInboxLines: inboxLines,
  });
}
