#!/usr/bin/env node
/**
 * Mem0 uses `better-sqlite3`; native bindings must match the current Node ABI.
 * If load fails, run `pnpm rebuild better-sqlite3` or `npm rebuild better-sqlite3`.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();

function tryLoad() {
  try {
    require("better-sqlite3");
    return true;
  } catch {
    return false;
  }
}

if (tryLoad()) {
  process.exit(0);
}

const rebuild = existsSync(path.join(root, "pnpm-lock.yaml"))
  ? "pnpm rebuild better-sqlite3"
  : "npm rebuild better-sqlite3";

console.warn(
  "[postinstall] better-sqlite3 bindings missing or wrong ABI; running rebuild…",
);
try {
  execSync(rebuild, { stdio: "inherit", cwd: root });
} catch {
  console.warn(
    `[postinstall] Rebuild failed. Fix Mem0 by running manually:\n  ${rebuild}`,
  );
  process.exit(0);
}

if (!tryLoad()) {
  console.warn(
    "[postinstall] better-sqlite3 still fails to load; Mem0 memory tools will error until you run:\n  " +
      rebuild,
  );
}
