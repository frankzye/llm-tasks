import { NextResponse } from "next/server";

import { runCliApprovedInSandbox } from "@/lib/agent/cli";

/**
 * Runs a user-approved arbitrary CLI in an isolated temp sandbox.
 * The chat UI calls this after the user clicks "Run" on a pending cli_run tool.
 */
export async function POST(req: Request) {
  let body: { command?: unknown; approved?: unknown };
  try {
    body = (await req.json()) as { command?: unknown; approved?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.approved !== true) {
    return NextResponse.json(
      { error: "approved must be true" },
      { status: 400 },
    );
  }
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) {
    return NextResponse.json({ error: "command required" }, { status: 400 });
  }

  try {
    const output = await runCliApprovedInSandbox(command);
    return NextResponse.json({ ok: true as const, output });
  } catch (e) {
    return NextResponse.json({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
