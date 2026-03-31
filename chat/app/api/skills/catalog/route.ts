import { NextResponse } from "next/server";

import {
  readSkillsCatalog,
  regenerateSkillsIndex,
} from "@/lib/agent/skills-catalog";
import { ensureSkillsIndex } from "@/lib/agent/skills-catalog-watcher";
import { globalSkillsDataDir } from "@/lib/global-skills-paths";

export async function GET() {
  const cwd = process.cwd();
  const root = globalSkillsDataDir(cwd);
  await ensureSkillsIndex(cwd);
  let catalog = await readSkillsCatalog(root);
  if (!catalog) {
    catalog = await regenerateSkillsIndex(root);
  }
  return NextResponse.json(catalog);
}
