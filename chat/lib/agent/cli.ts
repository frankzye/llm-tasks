import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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

function parseArgv(command: string): { bin: string; args: string[] } | null {
  const parts = command.trim().match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!parts?.length) return null;
  const unquote = (s: string) => s.replace(/^"(.*)"$/, "$1");
  const bin = unquote(parts[0]);
  const args = parts.slice(1).map(unquote);
  return { bin, args };
}

export function isCliCommandAllowlisted(command: string): boolean {
  const parsed = parseArgv(command);
  if (!parsed) return false;
  return ALLOWED.has(parsed.bin);
}

export function runCliAllowlisted(command: string, cwd: string): Promise<string> {
  const parsed = parseArgv(command);
  if (!parsed) {
    return Promise.resolve("Error: empty command");
  }

  return new Promise((resolve) => {
    const child = spawn(parsed.bin, parsed.args, {
      cwd,
      shell: false,
      env: { ...process.env, PATH: process.env.PATH },
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
 * Runs an allowlisted command in a fresh empty directory under the OS temp folder,
 * then deletes that directory. Avoids touching the project tree; each call is isolated.
 */
export async function runCliAllowlistedInSandbox(command: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), SANDBOX_DIR_PREFIX));
  try {
    return await runCliAllowlisted(command, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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
