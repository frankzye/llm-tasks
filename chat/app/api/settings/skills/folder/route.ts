import { NextResponse } from "next/server";

import { importSkillsFolderIntoData } from "@/lib/global-skills-folder-import";

export async function POST(req: Request) {
  let folderPath: string;
  try {
    const body = (await req.json()) as { folderPath?: string };
    folderPath = typeof body?.folderPath === "string" ? body.folderPath.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!folderPath) {
    return NextResponse.json({ error: "folderPath required" }, { status: 400 });
  }

  const cwd = process.cwd();

  try {
    const { dest } = await importSkillsFolderIntoData(cwd, folderPath);
    return NextResponse.json({
      ok: true,
      dest,
      note:
        "Copied markdown tree into .data/skills/from-folder/. Chat loads all of .data/skills/.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
