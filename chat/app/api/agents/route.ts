import { NextResponse } from "next/server";

import {
  createNewAgent,
  listAgentsFromDisk,
} from "@/lib/agent/agent-store";

/**
 * GET: list agents on disk (may be empty).
 * POST: create a new agent (e.g. "New agent" in the sidebar).
 */
export async function GET() {
  const cwd = process.cwd();
  const agents = await listAgentsFromDisk(cwd);
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const cwd = process.cwd();
  let name = "Agent";
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
