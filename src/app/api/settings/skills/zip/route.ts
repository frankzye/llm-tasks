import { NextResponse } from "next/server";

import { addGlobalSkillsFromZipUrl } from "@/src/lib/agent/skills-zip-import";
import { patchGlobalSettings } from "@/src/lib/global-settings";

export async function POST(req: Request) {
  let zipUrl: string;
  try {
    const body = (await req.json()) as { zipUrl?: string };
    zipUrl = typeof body?.zipUrl === "string" ? body.zipUrl.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!zipUrl) {
    return NextResponse.json({ error: "zipUrl required" }, { status: 400 });
  }

  const cwd = process.cwd();

  let folderName: string;
  try {
    const r = await addGlobalSkillsFromZipUrl(cwd, zipUrl);
    folderName = r.folderName;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const settings = await patchGlobalSettings(cwd, {
    skillsZipUrl: zipUrl,
    skillsZipLastImportedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    settings,
    folderName,
    note:
      "The zip is extracted into .data/skills/<zip-basename>/ (replaces that folder if it already existed). Git merges and from-folder/ are unchanged.",
  });
}
