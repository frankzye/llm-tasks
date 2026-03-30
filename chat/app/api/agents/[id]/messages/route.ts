import { NextResponse } from "next/server";
import type { UIMessage } from "ai";

import { readAgentConfig } from "@/lib/agent/agent-store";
import {
  readConversationMessages,
  writeConversationMessages,
} from "@/lib/agent/conversation-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const cwd = process.cwd();
  const existing = await readAgentConfig(cwd, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const messages = await readConversationMessages(cwd, id);
  return NextResponse.json({ messages });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const cwd = process.cwd();
  const existing = await readAgentConfig(cwd, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }
  await writeConversationMessages(cwd, id, messages as UIMessage[]);
  return NextResponse.json({ ok: true });
}
