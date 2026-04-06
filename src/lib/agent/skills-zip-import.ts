import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";

import { globalSkillsDataDir } from "@/src/lib/global-skills-paths";

/** Max downloaded zip size (bytes). */
export const SKILLS_ZIP_MAX_BYTES = 50 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 120_000;

/**
 * Browsers expose downloaded files as `blob:https://host/...`. The server must use the
 * HTTPS URL without the `blob:` prefix.
 */
export function normalizeZipDownloadUrl(raw: string): string {
  let u = raw.trim();
  if (u.toLowerCase().startsWith("blob:")) {
    u = u.slice(5).trim();
  }
  return u;
}

function assertSafeHttpsZipUrl(url: string): void {
  const u = url.trim();
  if (!u.startsWith("https://")) {
    throw new Error("Only https:// zip URLs are allowed.");
  }
  if (/[\s<>]/.test(u)) {
    throw new Error("Invalid URL.");
  }
}

function isInsideDir(parent: string, child: string): boolean {
  const p = path.resolve(parent);
  const c = path.resolve(child);
  const rel = path.relative(p, c);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function validateZipEntriesBeforeExtract(zip: AdmZip, destRoot: string): void {
  const base = path.resolve(destRoot);
  for (const e of zip.getEntries()) {
    const name = e.entryName.replace(/\\/g, "/");
    assertSafeZipName(name);
    const target = path.resolve(base, name);
    if (!isInsideDir(base, target)) {
      throw new Error("Zip path escape blocked.");
    }
  }
}

function assertSafeZipName(name: string): void {
  const n = name.replace(/\\/g, "/");
  if (!n || n.startsWith("/") || n.includes("..")) {
    throw new Error("Invalid zip entry path.");
  }
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8''|utf-8''|)([^;\n]+)/i);
  if (star) {
    const raw = star[1].trim().replace(/^"(.*)"$/, "$1");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const fn = header.match(/filename\s*=\s*(?:"([^"]*)"|([^;\s]+))/i);
  if (fn) return (fn[1] ?? fn[2] ?? "").trim();
  return null;
}

/**
 * Resolves the logical zip filename (e.g. `web-search-1.0.0.zip`) from headers or URL path.
 */
export function zipFilenameFromDownloadResponse(res: Response, zipUrl: string): string {
  const fromHeader = parseFilenameFromContentDisposition(
    res.headers.get("content-disposition"),
  );
  if (fromHeader) {
    const base = path.basename(fromHeader.replace(/\\/g, "/"));
    if (base && /\.zip$/i.test(base)) return base;
  }
  try {
    const u = new URL(zipUrl);
    const seg = path.basename(u.pathname);
    if (seg && /\.zip$/i.test(seg)) return seg;
  } catch {
    /* ignore */
  }
  throw new Error(
    "Could not determine the .zip file name. Use a URL whose path ends in .zip, or a server that sends Content-Disposition with a .zip filename.",
  );
}

/**
 * Single path segment under `skills/`, derived from the zip file basename without `.zip`.
 */
export function skillsFolderNameFromZipFilename(zipFilename: string): string {
  const base = path.basename(zipFilename.replace(/\\/g, "/"));
  const ext = path.extname(base);
  const without =
    ext.toLowerCase() === ".zip" ? base.slice(0, -ext.length) : base;
  const name = without.trim();
  if (!name || name === "." || name === "..") {
    throw new Error("Invalid zip file name.");
  }
  if (/[/\\:\0]/.test(name) || name.includes("..")) {
    throw new Error("Zip base name must not contain path separators.");
  }
  if (name.length > 200) {
    throw new Error("Zip base name is too long.");
  }
  return name;
}

/**
 * Download a zip from `zipUrl`, create/replace `skills/<zip-base-name>/` under the data
 * root (name from the .zip file, e.g. `web-search-1.0.0.zip` → `web-search-1.0.0`), and
 * unzip the archive there. Strips `.git` and `node_modules` after extract. Git merges and
 * `from-folder/` are unchanged.
 */
export async function addGlobalSkillsFromZipUrl(
  cwd: string,
  rawZipUrl: string,
): Promise<{ ok: true; path: string; folderName: string }> {
  const zipUrl = normalizeZipDownloadUrl(rawZipUrl);
  assertSafeHttpsZipUrl(zipUrl);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(zipUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "application/zip, application/octet-stream, */*",
        "User-Agent": "llm-tasks/skills-zip-import",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Download timed out.");
    }
    throw new Error(`Download failed: ${msg}`);
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    throw new Error(`Download failed (HTTP ${res.status}).`);
  }

  const zipFilename = zipFilenameFromDownloadResponse(res, zipUrl);
  const folderName = skillsFolderNameFromZipFilename(zipFilename);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error("Empty download.");
  }
  if (buf.byteLength > SKILLS_ZIP_MAX_BYTES) {
    throw new Error(`Zip too large (max ${SKILLS_ZIP_MAX_BYTES / (1024 * 1024)} MB).`);
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    throw new Error("Not a valid zip file.");
  }

  if (zip.getEntries().length === 0) {
    throw new Error("Zip is empty.");
  }

  const skillsRoot = globalSkillsDataDir(cwd);
  const dest = path.join(skillsRoot, folderName);
  await fs.mkdir(skillsRoot, { recursive: true });
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });

  validateZipEntriesBeforeExtract(zip, dest);
  zip.extractAllTo(dest, true);

  const st = await fs.stat(dest);
  if (!st.isDirectory()) {
    throw new Error("Extract failed.");
  }

  await fs.rm(path.join(dest, ".git"), { recursive: true, force: true }).catch(
    () => undefined,
  );
  await fs
    .rm(path.join(dest, "node_modules"), { recursive: true, force: true })
    .catch(() => undefined);

  return { ok: true, path: dest, folderName };
}
