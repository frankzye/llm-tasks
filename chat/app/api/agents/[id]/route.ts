import { NextResponse } from "next/server";

import {
  deleteAgentDir,
  readAgentConfig,
  updateAgentConfigPartial,
  type AgentConfigPatch,
} from "@/lib/agent/agent-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const config = await readAgentConfig(process.cwd(), id);
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(config);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: AgentConfigPatch = {};

  if (typeof body.name === "string") {
    patch.name = body.name;
  }
  if ("systemPrompt" in body) {
    if (body.systemPrompt === null) {
      patch.systemPrompt = null;
    } else if (typeof body.systemPrompt === "string") {
      patch.systemPrompt = body.systemPrompt;
    }
  }
  if ("maxTokens" in body) {
    if (body.maxTokens === null) {
      patch.maxTokens = null;
    } else if (typeof body.maxTokens === "number") {
      patch.maxTokens = body.maxTokens;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields (name, systemPrompt, maxTokens)" },
      { status: 400 },
    );
  }

  const updated = await updateAgentConfigPartial(process.cwd(), id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteAgentDir(process.cwd(), id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
