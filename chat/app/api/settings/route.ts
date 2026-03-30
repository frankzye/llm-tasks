import { NextResponse } from "next/server";

import {
  patchGlobalSettings,
  readGlobalSettings,
  type GlobalSettings,
} from "@/lib/global-settings";

export async function GET() {
  const cwd = process.cwd();
  const s = await readGlobalSettings(cwd);
  return NextResponse.json(s);
}

export async function PATCH(req: Request) {
  const cwd = process.cwd();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<GlobalSettings> = {};

  if ("skillsFolderPath" in body) {
    if (body.skillsFolderPath === null || body.skillsFolderPath === "") {
      patch.skillsFolderPath = null;
    } else if (typeof body.skillsFolderPath === "string") {
      patch.skillsFolderPath = body.skillsFolderPath.trim() || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields (skillsFolderPath)" },
      { status: 400 },
    );
  }

  const next = await patchGlobalSettings(cwd, patch);
  return NextResponse.json(next);
}
