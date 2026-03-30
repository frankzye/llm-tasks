import { spawn } from "node:child_process";

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

export function runCliAllowlisted(command: string, cwd: string): Promise<string> {
  const parsed = parseArgv(command);
  if (!parsed) {
    return Promise.resolve("Error: empty command");
  }
  if (!ALLOWED.has(parsed.bin)) {
    return Promise.resolve(
      `Error: command not allowed. Allowed: ${[...ALLOWED].sort().join(", ")}`,
    );
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
