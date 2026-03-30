import fs from "node:fs/promises";
import path from "node:path";

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
  for (const full of mdPaths) {
    const raw = await fs.readFile(full, "utf8");
    const rel = path.relative(skillsDir, full);
    const id = rel
      .replace(/\\/g, "/")
      .replace(/\.md$/i, "")
      .replace(/\//g, "__");
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
