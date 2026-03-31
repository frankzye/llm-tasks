import fs from "node:fs/promises";
import path from "node:path";

export type SkillsCatalogEntry = {
  id: string;
  name: string;
  description: string;
  path: string;
};

export type SkillsCatalogFile = {
  generatedAt: string;
  skillsRoot: string;
  skills: SkillsCatalogEntry[];
};

const SKILL_MD = /^SKILL\.md$/i;

export function parseSkillMdFrontmatter(raw: string): {
  name?: string;
  description?: string;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const yaml = m?.[1];
  const body = m ? m[2] : raw;
  if (!yaml) return { body };
  let name: string | undefined;
  let description: string | undefined;
  const unquoted = (s: string) => s.replace(/^["']|["']$/g, "").trim();
  for (const line of yaml.split(/\r?\n/)) {
    const nm = line.match(/^name:\s*(.+)$/);
    if (nm) name = unquoted(nm[1]);
    const dm = line.match(/^description:\s*(.+)$/);
    if (dm) description = unquoted(dm[1]);
  }
  return { name, description, body };
}

/** Stable id for SKILL.md: frontmatter `name`, else parent folder name. */
export function skillIdFromSkillMdPath(
  relFromSkillsRoot: string,
  fmName?: string,
): string {
  const n = fmName?.trim();
  if (n) return n;
  const norm = relFromSkillsRoot.replace(/\\/g, "/");
  const dir = path.posix.dirname(norm);
  if (dir && dir !== ".") {
    const seg = dir.split("/").filter(Boolean).pop();
    if (seg) return seg;
  }
  return norm.replace(/\/SKILL\.md$/i, "").replace(/^.*\//, "") || "skill";
}

/** Same id assignment as `regenerateSkillsIndex` (sorted by `rel` for stable collisions). */
export function assignSkillMdIds(
  entries: Array<{ rel: string; raw: string }>,
): Map<string, string> {
  const sorted = [...entries].sort((a, b) => a.rel.localeCompare(b.rel));
  const relToId = new Map<string, string>();
  const seenIds = new Set<string>();
  for (const { rel, raw } of sorted) {
    const fm = parseSkillMdFrontmatter(raw);
    let id = skillIdFromSkillMdPath(rel, fm.name);
    if (seenIds.has(id)) {
      const base = path.posix.dirname(rel).split("/").filter(Boolean).pop() ?? id;
      id = `${base}__${seenIds.size}`;
    }
    while (seenIds.has(id)) {
      id = `${id}_dup`;
    }
    seenIds.add(id);
    relToId.set(rel, id);
  }
  return relToId;
}

async function walkSkillMdFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkSkillMdFiles(full)));
    } else if (e.isFile() && SKILL_MD.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

export async function regenerateSkillsIndex(skillsRoot: string): Promise<SkillsCatalogFile> {
  const absRoot = path.resolve(skillsRoot);
  await fs.mkdir(absRoot, { recursive: true });
  const files = await walkSkillMdFiles(absRoot);
  const entries: Array<{ rel: string; raw: string }> = [];
  for (const full of files) {
    const rel = path.relative(absRoot, full).replace(/\\/g, "/");
    let raw = "";
    try {
      raw = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }
    entries.push({ rel, raw });
  }
  const relToId = assignSkillMdIds(entries);
  const skills: SkillsCatalogEntry[] = [];
  for (const { rel, raw } of entries) {
    const fm = parseSkillMdFrontmatter(raw);
    const id = relToId.get(rel)!;
    const name = fm.name?.trim() || id;
    const description = fm.description ?? "";
    skills.push({
      id,
      name,
      description,
      path: rel,
    });
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));

  const catalog: SkillsCatalogFile = {
    generatedAt: new Date().toISOString(),
    skillsRoot: absRoot,
    skills,
  };

  const outPath = path.join(absRoot, "skills.json");
  await fs.writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return catalog;
}

export async function readSkillsCatalog(skillsRoot: string): Promise<SkillsCatalogFile | null> {
  const p = path.join(path.resolve(skillsRoot), "skills.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as SkillsCatalogFile;
    if (!parsed || !Array.isArray(parsed.skills)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function catalogIdSet(catalog: SkillsCatalogFile | null): Set<string> {
  if (!catalog) return new Set();
  return new Set(catalog.skills.map((s) => s.id));
}
