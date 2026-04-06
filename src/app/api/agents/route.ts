import { NextResponse } from "next/server";

import {
  createNewAgent,
  listAgentsFromDisk,
} from "@/src/lib/agent/agent-store";
import { generateAgentName } from "@/src/lib/agent-name";

/**
 * GET: list agents on disk. If none exist yet, creates one default agent and returns it.
 * POST: create a new agent (e.g. "New agent" in the sidebar).
 */
export async function GET() {
  const cwd = process.cwd();
  let agents = await listAgentsFromDisk(cwd);
  if (agents.length === 0) {
    await createNewAgent(cwd, generateAgentName());
    agents = await listAgentsFromDisk(cwd);
  }
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const cwd = process.cwd();
  let name = generateAgentName();
  try {
    const body = (await req.json()) as { name?: string };
    if (typeof body?.name === "string" && body.name.trim()) {
      name = body.name.trim();
    }
  } catch {
    /* empty body */
  }
  const agent = await createNewAgent(cwd, name);
  return NextResponse.json(agent);
}
