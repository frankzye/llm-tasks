import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

import { globalSkillsDataDir } from "@/lib/global-skills-paths";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 180_000;

/** User folder import lives here; never removed on Git sync. */
const PRESERVE_DIR = "from-folder";

function assertSafeGitUrl(url: string): void {
  const u = url.trim();
  if (!u.startsWith("https://")) {
    throw new Error("Only https:// git URLs are allowed.");
  }
  if (/[\s<>]/.test(u)) {
    throw new Error("Invalid URL.");
  }
}

/** Normalize root repo URL for `git clone` (always https, ends with .git). */
function toCloneUrl(repoRoot: string): string {
  let u = repoRoot.trim().replace(/\/$/, "");
  if (u.endsWith(".git")) return u;
  return `${u}.git`;
}

export type ParsedSkillsGitInput = {
  cloneUrl: string;
  branch: string;
  /** Path inside the repo to sparse-checkout (e.g. `skills`). Empty = entire repo root. */
  subpath: string;
};

/** Strip trailing slash and mistaken `.git` on a path segment (common in pasted tree URLs). */
function normalizeTreePathRest(rest: string): string {
  let sub = rest.replace(/\/$/, "").trim();
  if (sub.endsWith(".git")) sub = sub.slice(0, -4).trim();
  return sub;
}

/**
 * Parses GitHub / Gitee tree and repo-root URLs:
 * - `.../org/repo/tree/branch/rel/path` → clone `https://host/org/repo`, branch, subpath
 * - `https://gitee.com/airbmw/skills/tree/klazuka/export/skills/doc` → branch `klazuka`, subpath `export/skills/doc`
 * - `.../org/repo` → branch `main`, subpath `skills`
 */
export function parseSkillsGitInput(raw: string): ParsedSkillsGitInput | null {
  const s = raw.trim();
  const tree = s.match(
    /^https:\/\/(github\.com|gitee\.com)\/([^/]+)\/([^/]+?)(?:\.git)?\/tree\/([^/]+)\/?(.*)$/,
  );
  if (tree) {
    const [, host, owner, repo, branch, rest] = tree;
    const sub = normalizeTreePathRest(rest);
    return {
      cloneUrl: toCloneUrl(`https://${host}/${owner}/${repo}`),
      branch,
      subpath: sub || "skills",
    };
  }

  const root = s.match(
    /^https:\/\/(github\.com|gitee\.com)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  );
  if (root) {
    const [, host, owner, repo] = root;
    return {
      cloneUrl: toCloneUrl(`https://${host}/${owner}/${repo}`),
      branch: "main",
      subpath: "skills",
    };
  }

  return null;
}

function resolveSubpath(
  parsed: ParsedSkillsGitInput | null,
  opts?: { subpath?: string | null },
): string {
  if (opts?.subpath === null || opts?.subpath === "") return "";
  if (opts?.subpath !== undefined && opts.subpath.trim() !== "") {
    return opts.subpath.replace(/\/$/, "").trim();
  }
  if (parsed) return parsed.subpath;
  return "skills";
}

function applyOverrides(
  parsed: ParsedSkillsGitInput | null,
  raw: string,
  opts?: { branch?: string; subpath?: string | null },
): ParsedSkillsGitInput {
  if (parsed) {
    return {
      cloneUrl: parsed.cloneUrl,
      branch: opts?.branch?.trim() || parsed.branch,
      subpath: resolveSubpath(parsed, opts),
    };
  }

  const t = raw.trim();
  if (/\/tree\//i.test(t)) {
    throw new Error(
      "Unsupported repository tree URL. Use GitHub or Gitee, e.g. https://gitee.com/owner/repo/tree/branch/folder/path",
    );
  }

  assertSafeGitUrl(raw);
  const cloneUrl = raw.trim().replace(/\/$/, "");
  const withGit = cloneUrl.endsWith(".git") ? cloneUrl : `${cloneUrl}.git`;
  return {
    cloneUrl: withGit,
    branch: opts?.branch?.trim() || "main",
    subpath: resolveSubpath(null, opts),
  };
}

/** Remove previous Git sync output; keep {@link PRESERVE_DIR} (folder import). */
async function clearSkillsRootForGitSync(skillsRoot: string): Promise<void> {
  await fs.mkdir(skillsRoot, { recursive: true });
  let entries;
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === PRESERVE_DIR) continue;
    await fs.rm(path.join(skillsRoot, ent.name), { recursive: true, force: true });
  }
}

/** Copy every top-level entry from `srcDir` into `destRoot` (overwrites same name). Skips `.git`. */
async function copyTopLevelIntoDest(srcDir: string, destRoot: string): Promise<void> {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === ".git") continue;
    const from = path.join(srcDir, ent.name);
    const to = path.join(destRoot, ent.name);
    await fs.rm(to, { recursive: true, force: true });
    await fs.cp(from, to, { recursive: true });
  }
}

/**
 * Clone into a temp dir, then copy **all top-level items** from the chosen subfolder
 * (or repo root if no subpath) **directly** into `skillsRoot` (e.g. `.data/skills/`),
 * not under `_git/skills/`.
 */
export async function syncSkillsFromGitIntoSkillsRoot(
  skillsRoot: string,
  gitUrl: string,
  opts?: { branch?: string; subpath?: string | null },
): Promise<{ ok: true; path: string }> {
  const parsed = parseSkillsGitInput(gitUrl);
  const { cloneUrl, branch, subpath } = applyOverrides(parsed, gitUrl, opts);

  assertSafeGitUrl(cloneUrl);

  await clearSkillsRootForGitSync(skillsRoot);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "llm-skills-git-"));

  try {
    if (!subpath) {
      await execFileAsync(
        "git",
        ["clone", "--depth", "1", "--branch", branch, "--single-branch", cloneUrl, tmpDir],
        { timeout: GIT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
      await copyTopLevelIntoDest(tmpDir, skillsRoot);
      return { ok: true, path: skillsRoot };
    }

    try {
      await execFileAsync(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--branch",
          branch,
          "--single-branch",
          "--filter=blob:none",
          "--sparse",
          cloneUrl,
          tmpDir,
        ],
        { timeout: GIT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
      await execFileAsync(
        "git",
        ["sparse-checkout", "set", subpath],
        {
          cwd: tmpDir,
          timeout: GIT_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    } catch {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await execFileAsync(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--branch",
          branch,
          "--single-branch",
          cloneUrl,
          tmpDir,
        ],
        { timeout: GIT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );
    }

    const srcDir = path.join(tmpDir, ...subpath.split("/").filter(Boolean));
    await fs.access(srcDir);
    await copyTopLevelIntoDest(srcDir, skillsRoot);
    return { ok: true, path: skillsRoot };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Sync global skills from Git into `.data/skills/` (flat; subfolder contents only). */
export async function syncGlobalSkillsFromGit(
  cwd: string,
  gitUrl: string,
  opts?: { branch?: string; subpath?: string | null },
): Promise<{ ok: true; path: string }> {
  const skillsRoot = globalSkillsDataDir(cwd);
  await fs.mkdir(skillsRoot, { recursive: true });
  return syncSkillsFromGitIntoSkillsRoot(skillsRoot, gitUrl, opts);
}
