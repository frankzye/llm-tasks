import fs from "node:fs/promises";
import path from "node:path";

import {
  assignSkillMdIds,
  parseSkillMdFrontmatter,
  type SkillsCatalogFile,
} from "./skills-catalog";

export type SkillRecord = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  tokens: string[];
};

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const [k, va] of smaller) {
    const vb = larger.get(k);
    if (vb !== undefined) dot += va * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function documentFrequency(skills: SkillRecord[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const s of skills) {
    const unique = new Set(s.tokens);
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  return df;
}

function bm25Score(
  queryTerms: string[],
  docTokens: string[],
  avgDocLen: number,
  N: number,
  df: Map<string, number>,
  k1 = 1.2,
  b = 0.75,
): number {
  const tf = termFreq(docTokens);
  const len = docTokens.length || 1;
  let score = 0;
  for (const q of queryTerms) {
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    const n = df.get(q) ?? 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + (b * len) / avgDocLen);
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

async function collectMarkdownPaths(rootDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string) {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const p = path.join(dir, name);
      let st;
      try {
        st = await fs.stat(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === ".git") continue;
        await walk(p);
      } else if (st.isFile() && name.endsWith(".md")) {
        out.push(p);
      }
    }
  }

  await walk(rootDir);
  return out;
}

export async function loadSkillsFromDisk(skillsDir: string): Promise<SkillRecord[]> {
  const mdPaths = await collectMarkdownPaths(skillsDir);
  const out: SkillRecord[] = [];
  const skillMdEntries: Array<{ full: string; rel: string; raw: string }> = [];

  for (const full of mdPaths) {
    const base = path.basename(full);
    if (/^SKILL\.md$/i.test(base)) {
      const raw = await fs.readFile(full, "utf8");
      const rel = path.relative(skillsDir, full).replace(/\\/g, "/");
      skillMdEntries.push({ full, rel, raw });
    }
  }

  const idByRel = assignSkillMdIds(
    skillMdEntries.map(({ rel, raw }) => ({ rel, raw })),
  );

  for (const { rel, raw } of skillMdEntries) {
    const fm = parseSkillMdFrontmatter(raw);
    const id = idByRel.get(rel)!;
    const titleMatch = fm.body.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? fm.name?.trim() ?? id;
    const body = fm.body;
    const tagLine = fm.body.match(/^tags:\s*(.+)$/m)?.[1] ?? "";
    const tags = tagLine
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tokens = tokenize(
      `${id} ${title} ${fm.description ?? ""} ${tags.join(" ")} ${body}`,
    );
    out.push({ id, title, body, tags, tokens });
  }

  const skillMdFull = new Set(skillMdEntries.map((e) => e.full));
  for (const full of mdPaths) {
    if (skillMdFull.has(full)) continue;
    const raw = await fs.readFile(full, "utf8");
    const rel = path.relative(skillsDir, full).replace(/\\/g, "/");
    const id = rel.replace(/\.md$/i, "").replace(/\//g, "__");
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? id;
    const tagLine = raw.match(/^tags:\s*(.+)$/m)?.[1] ?? "";
    const tags = tagLine
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const body = raw;
    const tokens = tokenize(`${title} ${tags.join(" ")} ${body}`);
    out.push({ id, title, body, tags, tokens });
  }
  return out;
}

export type SkillSearchHit = { id: string; title: string; snippet: string; score: number };

/**
 * Hybrid retrieval: BM25-style sparse score + bag-of-words cosine ("dense" proxy).
 * Suitable for local skill files without an embedding API.
 */
export function searchSkillsHybrid(
  query: string,
  skills: SkillRecord[],
  topK: number,
): SkillSearchHit[] {
  const qTerms = tokenize(query);
  if (qTerms.length === 0) {
    return skills.slice(0, topK).map((s) => ({
      id: s.id,
      title: s.title,
      snippet: s.body.slice(0, 200).replace(/\s+/g, " ") + (s.body.length > 200 ? "…" : ""),
      score: 0,
    }));
  }
  const qTf = termFreq(qTerms);
  const N = skills.length || 1;
  const df = documentFrequency(skills);
  const avgLen =
    skills.reduce((a, s) => a + s.tokens.length, 0) / Math.max(skills.length, 1);

  const ranked = skills.map((s) => {
    const sparse = bm25Score(qTerms, s.tokens, avgLen, N, df);
    const sTf = termFreq(s.tokens);
    const dense = cosineSim(qTf, sTf);
    const score = 0.55 * sparse + 0.45 * dense;
    const snippet =
      s.body.slice(0, 280).replace(/\s+/g, " ") + (s.body.length > 280 ? "…" : "");
    return { id: s.id, title: s.title, snippet, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topK);
}

export function getSkillById(skills: SkillRecord[], id: string): SkillRecord | undefined {
  return skills.find((s) => s.id === id);
}

/** When `enabledSkillIds` is null or undefined, all catalog skills are allowed. When an array (possibly empty), only those ids in the catalog set are kept; skills not in `catalogIds` (e.g. agent-local) are always kept. */
export function filterSkillsForCatalog(
  skills: SkillRecord[],
  catalogIds: Set<string>,
  enabledSkillIds: string[] | null | undefined,
): SkillRecord[] {
  if (enabledSkillIds == null) {
    return skills;
  }
  const allow = new Set(enabledSkillIds);
  return skills.filter((s) => {
    if (!catalogIds.has(s.id)) return true;
    return allow.has(s.id);
  });
}

function firstParagraphSnippet(body: string, maxChars: number): string {
  const stripped = body.replace(/^---[\s\S]*?---\s*/, "").trim();
  const chunk = (stripped.split(/\n\n+/)[0] ?? stripped).replace(/\s+/g, " ").trim();
  if (chunk.length <= maxChars) return chunk;
  return `${chunk.slice(0, Math.max(0, maxChars - 1))}…`;
}

function compactText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Compact inventory for the system prompt as minified JSON.
 * Includes exact `skillId` plus `name` + `description` (catalog description preferred; else first paragraph).
 */
export function formatSkillsInventoryForSystem(
  skills: SkillRecord[],
  catalog: SkillsCatalogFile | null,
  options?: { maxSkills?: number; maxDescChars?: number; maxTotalChars?: number },
): string {
  const maxSkills = options?.maxSkills ?? 100;
  const maxDescChars = options?.maxDescChars ?? 280;
  const maxTotalChars = options?.maxTotalChars ?? 14_000;

  const byId = new Map<string, { name: string; description: string }>();
  if (catalog?.skills) {
    for (const e of catalog.skills) {
      byId.set(e.id, { name: e.name, description: e.description ?? "" });
    }
  }

  const sorted = [...skills].sort((a, b) => a.id.localeCompare(b.id));
  const items: Array<{ skillId: string; name: string; description: string }> = [];

  for (const s of sorted) {
    if (items.length >= maxSkills) break;
    const meta = byId.get(s.id);
    const name = compactText(meta?.name ?? s.title) || s.id;
    let description = compactText(meta?.description ?? "");
    if (!description) {
      description = compactText(firstParagraphSnippet(s.body, maxDescChars));
    } else if (description.length > maxDescChars) {
      description = `${description.slice(0, Math.max(0, maxDescChars - 1))}…`;
    }
    items.push({ skillId: s.id, name, description });
  }

  // Minified JSON (no spaces/newlines) to reduce tokens.
  // If it exceeds budget, drop tail items until it fits.
  const base = { skills: items };
  let json = JSON.stringify(base);
  if (json.length > maxTotalChars) {
    const trimmed: typeof items = [];
    for (const it of items) {
      trimmed.push(it);
      const candidate = JSON.stringify({ skills: trimmed });
      if (candidate.length > maxTotalChars) {
        trimmed.pop();
        break;
      }
    }
    json = JSON.stringify({ skills: trimmed });
  }
  return json;
}

/**
 * Merges skills: `globalSkillsDir`, then each `extraGlobalDirs` in order, then `agentSkillsDir`.
 * Later sources override earlier; agent wins on duplicate ids.
 */
export async function loadSkillsMerged(
  globalSkillsDir: string,
  agentSkillsDir: string,
  extraGlobalDirs: string[] = [],
): Promise<SkillRecord[]> {
  const byId = new Map<string, SkillRecord>();

  const mergeDir = async (dir: string) => {
    const part = await loadSkillsFromDisk(dir).catch(() => [] as SkillRecord[]);
    for (const s of part) {
      byId.set(s.id, s);
    }
  };

  await mergeDir(globalSkillsDir);
  for (const d of extraGlobalDirs) {
    const t = d.trim();
    if (t) await mergeDir(t);
  }
  await mergeDir(agentSkillsDir);

  return [...byId.values()];
}
