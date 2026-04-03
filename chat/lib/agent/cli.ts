import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Allowlisted binaries only; no shell interpolation. */
const ALLOWED = new Set([
  "pwd",
  "echo",
  "date",
  "uname",
  "whoami",
  "hostname",
  "wc",
  "ls",
]);
const SHELL_META_RE = /[|&;<>()`$]/;

function parseArgv(command: string): { bin: string; args: string[] } | null {
  const parts = command.trim().match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!parts?.length) return null;
  const unquote = (s: string) => s.replace(/^"(.*)"$/, "$1");
  const bin = unquote(parts[0]);
  const args = parts.slice(1).map(unquote);
  return { bin, args };
}

/** First token of the command line (the program name), e.g. `npm` from `npm run dev`. */
export function extractCliBinary(command: string): string | null {
  const parsed = parseArgv(command.trim());
  const bin = parsed?.bin?.trim();
  return bin && bin.length > 0 ? bin : null;
}

function allowListBinKey(bin: string): string {
  return bin.trim().toLowerCase();
}

/** Program names only (first token per line); dedupe case-insensitively. */
export function normalizeCliAlwaysAllowList(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of entries) {
    const t = raw.trim();
    if (!t) continue;
    const bin = extractCliBinary(t) ?? t.split(/\s+/)[0];
    if (!bin?.trim()) continue;
    const b = bin.trim();
    const k = allowListBinKey(b);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

export function isCliCommandAllowlisted(command: string): boolean {
  const parsed = parseArgv(command);
  if (!parsed) return false;
  if (SHELL_META_RE.test(command)) return false;
  return ALLOWED.has(parsed.bin);
}

function normalizeAlwaysAllowCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

/**
 * True when the command's CLI binary (first token) is in the allow list, or when the full
 * normalized line matches a legacy saved entry.
 */
export function isCliCommandInAlwaysAllowList(
  command: string,
  list: string[] | undefined,
): boolean {
  if (!list?.length) return false;
  const bin = extractCliBinary(command);
  if (bin) {
    const key = allowListBinKey(bin);
    const keys = new Set(list.map((e) => allowListBinKey(e)));
    if (keys.has(key)) return true;
  }
  const full = normalizeAlwaysAllowCommand(command);
  if (!full) return false;
  return list.some((e) => normalizeAlwaysAllowCommand(e) === full);
}

export function runCliAllowlisted(command: string, cwd: string): Promise<string> {
  const trimmed = command.trim();
  if (!trimmed) {
    return Promise.resolve("Error: empty command");
  }

  return new Promise((resolve) => {
    const child = spawn(trimmed, {
      cwd,
      shell: true,
      env: { ...process.env, PATH: process.env.PATH },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve("Error: command timed out (10s)");
    }, 10_000);
    child.stdout?.on("data", (d) => {
      out += String(d);
    });
    child.stderr?.on("data", (d) => {
      err += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const combined = [out, err].filter(Boolean).join("\n").trim();
      resolve(
        combined || `(exit ${code ?? "unknown"})`,
      );
    });
    child.on("error", (e) => {
      clearTimeout(timeout);
      resolve(`Error: ${e instanceof Error ? e.message : String(e)}`);
    });
  });
}

const SANDBOX_DIR_PREFIX = "llm-tasks-cli-";

/**
 * Runs an allowlisted command in a per-agent persistent sandbox directory under
 * `.data/agents/<agentId>/`.
 */
export async function runCliAllowlistedInSandbox(
  command: string,
  projectCwd: string,
  agentId: string,
): Promise<string> {
  const dir = path.join(projectCwd, ".data", "agents", agentId, SANDBOX_DIR_PREFIX);
  await mkdir(dir, { recursive: true });
  return runCliAllowlisted(command, dir);
}

/**
 * Runs an arbitrary shell command in a fresh temp sandbox (user-approved in UI).
 * Uses the system shell; isolated cwd; temp dir removed after run.
 */
export async function runCliApprovedInSandbox(command: string): Promise<string> {
  const trimmed = command.trim();
  if (!trimmed) {
    return "Error: empty command";
  }
  const dir = await mkdtemp(path.join(tmpdir(), SANDBOX_DIR_PREFIX));
  try {
    return await new Promise<string>((resolve) => {
      const child = spawn(trimmed, {
        cwd: dir,
        shell: true,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve("Error: command timed out (120s)");
      }, 120_000);
      child.stdout?.on("data", (d) => {
        stdout += String(d);
      });
      child.stderr?.on("data", (d) => {
        stderr += String(d);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (!combined && code !== 0) {
          resolve(`(exit ${code ?? "unknown"})`);
          return;
        }
        if (code !== 0 && combined) {
          resolve(`Exit ${code ?? "?"}:\n${combined}`);
          return;
        }
        resolve(combined || "(no output)");
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve(`Error: ${e instanceof Error ? e.message : String(e)}`);
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
