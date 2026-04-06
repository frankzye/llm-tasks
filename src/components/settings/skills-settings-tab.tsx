"use client";

import { useCallback, useEffect, useState } from "react";

type SettingsApi = {
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  skillsZipUrl?: string;
  skillsZipLastImportedAt?: string;
  skillsFolderPath?: string | null;
};

type CatalogSkill = {
  id: string;
  name: string;
  description: string;
  path: string;
};

export function SkillsSettingsTab() {
  const [settings, setSettings] = useState<SettingsApi | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [zipUrl, setZipUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [runtimePath, setRuntimePath] = useState("");
  const [gitBusy, setGitBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [catalogSkills, setCatalogSkills] = useState<CatalogSkill[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogBusy(true);
    try {
      const r = await fetch("/api/skills/catalog");
      if (!r.ok) throw new Error(`Catalog load failed (${r.status})`);
      const c = (await r.json()) as { skills?: CatalogSkill[] };
      setCatalogSkills(Array.isArray(c.skills) ? c.skills : []);
    } catch (e) {
      setCatalogSkills([]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCatalogBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const s = (await r.json()) as SettingsApi;
      setSettings(s);
      setGitUrl(s.skillsGitUrl ?? "");
      setZipUrl(s.skillsZipUrl ?? "");
      setRuntimePath(s.skillsFolderPath ?? "");
      await loadCatalog();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [loadCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllCatalog(checked: boolean) {
    if (checked) {
      setSelectedSkillIds(new Set(catalogSkills.map((s) => s.id)));
    } else {
      setSelectedSkillIds(new Set());
    }
  }

  async function installFromZip() {
    if (!zipUrl.trim()) {
      setErr("Enter an https:// URL that serves a .zip file.");
      return;
    }
    setZipBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings/skills/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipUrl: zipUrl.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        settings?: SettingsApi;
        folderName?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `Install from zip failed (${r.status})`);
      if (j.settings) setSettings(j.settings);
      const sub = j.folderName ? `skills/${j.folderName}/` : "skills/<name>/";
      setOkMsg(`Zip extracted to ${sub} under the data root.`);
      await loadCatalog();
      setSelectedSkillIds(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
    }
  }

  async function addFromGit() {
    if (!gitUrl.trim()) {
      setErr("Enter an https:// git URL.");
      return;
    }
    setGitBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings/skills/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitUrl: gitUrl.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        settings?: SettingsApi;
      };
      if (!r.ok) throw new Error(j.error ?? `Add from Git failed (${r.status})`);
      if (j.settings) setSettings(j.settings);
      setOkMsg("Skills from Git merged into the global skills folder (add/override).");
      await loadCatalog();
      setSelectedSkillIds(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGitBusy(false);
    }
  }

  async function deleteSelectedSkills() {
    if (selectedSkillIds.size === 0) {
      setErr("Select at least one skill to delete.");
      return;
    }
    setDeleteBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings/skills/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [...selectedSkillIds] }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        deleted?: string[];
        notFound?: string[];
      };
      if (!r.ok) throw new Error(j.error ?? `Delete failed (${r.status})`);
      const deleted = j.deleted?.length ?? 0;
      const notFound = j.notFound?.length ?? 0;
      setOkMsg(
        `Removed ${deleted} skill(s).` +
          (notFound > 0 ? ` ${notFound} id(s) could not be removed.` : ""),
      );
      setSelectedSkillIds(new Set());
      await loadCatalog();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function importFolder() {
    if (!folderPath.trim()) {
      setErr("Enter an absolute folder path on the server.");
      return;
    }
    setFolderBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings/skills/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath: folderPath.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Import failed (${r.status})`);
      setOkMsg("Folder copied into skills/from-folder/ under the data root.");
      setFolderPath("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setFolderBusy(false);
    }
  }

  async function saveRuntimePath() {
    setSaveBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillsFolderPath: runtimePath.trim() === "" ? null : runtimePath.trim(),
        }),
      });
      const next = (await r.json()) as SettingsApi & { error?: string };
      if (!r.ok) throw new Error(next.error ?? `Save failed (${r.status})`);
      setSettings(next);
      setRuntimePath(next.skillsFolderPath ?? "");
      setOkMsg("Extra path saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm leading-relaxed text-[#5f6368] dark:text-[#9aa0a6]">
        Global skills are merged for all agents from the data-root{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          skills/
        </code>{" "}
        folder (add from Git merges top-level items; existing skills stay unless
        overridden by name).{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          from-folder/
        </code>{" "}
        and zip installs (each under{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          {"<zip-basename>/"}
        </code>
        ) are never removed by Git. Optional legacy repo{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          skills/
        </code>
        , and an optional extra directory path below. Per-agent skills under the
        data root override on duplicate skill ids.
      </p>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Add from Git
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          HTTPS only. Paste a{" "}
          <strong className="font-medium text-[#444746] dark:text-[#c4c7c5]">
            repo root
          </strong>{" "}
          or a{" "}
          <strong className="font-medium text-[#444746] dark:text-[#c4c7c5]">
            tree
          </strong>{" "}
          link (GitHub / Gitee):{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            {"…/owner/repo/tree/<branch>/<folder/path>"}
          </code>
          . Root URLs default to branch{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">main</code>{" "}
          and folder{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">skills</code>
          .
        </p>
        <input
          value={gitUrl}
          onChange={(e) => setGitUrl(e.target.value)}
          placeholder="https://github.com/anthropics/skills"
          className="mb-3 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={gitBusy}
            onClick={() => void addFromGit()}
            className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
          >
            {gitBusy ? "Cloning…" : "Add from Git"}
          </button>
          {settings?.skillsGitLastSyncedAt ? (
            <span className="text-xs text-[#70757a]">
              Last added: {settings.skillsGitLastSyncedAt}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Install from zip URL
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          HTTPS only. Paste a direct download link to a skill package (for example{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            web-search-1.0.0.zip
          </code>
          ). If your browser shows a{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            blob:https://...
          </code>{" "}
          URL, paste it as-is — the server strips the{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">blob:</code>{" "}
          prefix and downloads{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            https://...
          </code>
          . The archive is unpacked into{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            {"skills/<zip-basename>/"}
          </code>{" "}
          (same name as the{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">.zip</code>{" "}
          file, from the URL path or{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            Content-Disposition
          </code>
          ; replaces that folder if it already exists).
        </p>
        <input
          value={zipUrl}
          onChange={(e) => setZipUrl(e.target.value)}
          placeholder="https://example.com/path/to/skill.zip"
          className="mb-3 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={zipBusy}
            onClick={() => void installFromZip()}
            className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
          >
            {zipBusy ? "Downloading…" : "Install from zip URL"}
          </button>
          {settings?.skillsZipLastImportedAt ? (
            <span className="text-xs text-[#70757a]">
              Last installed: {settings.skillsZipLastImportedAt}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Delete skills
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          Select skills stored under the global skills folder and remove them from disk.
          To remove skills that came from Git without clearing unrelated files, use this
          instead of re-syncing the whole catalog.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#1f1f1f] dark:text-[#e3e3e3]">
            <input
              type="checkbox"
              checked={
                catalogSkills.length > 0 &&
                selectedSkillIds.size === catalogSkills.length
              }
              onChange={(e) => selectAllCatalog(e.target.checked)}
              disabled={catalogBusy || catalogSkills.length === 0}
              className="h-4 w-4 rounded border-[#dadce0] dark:border-[#3c4043]"
            />
            Select all
          </label>
          <button
            type="button"
            disabled={deleteBusy || selectedSkillIds.size === 0}
            onClick={() => void deleteSelectedSkills()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {deleteBusy ? "Deleting…" : `Delete selected (${selectedSkillIds.size})`}
          </button>
          {catalogBusy ? (
            <span className="text-xs text-[#70757a]">Loading catalog…</span>
          ) : (
            <span className="text-xs text-[#70757a]">
              {catalogSkills.length} skill(s) in catalog
            </span>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-[#dadce0] dark:border-[#3c4043]">
          {catalogSkills.length === 0 && !catalogBusy ? (
            <p className="p-3 text-sm text-[#70757a]">No skills in catalog yet.</p>
          ) : (
            <ul className="divide-y divide-[#dadce0] dark:divide-[#3c4043]">
              {catalogSkills.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 px-3 py-2 text-sm hover:bg-[#f8f9fa] dark:hover:bg-[#1e1f20]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSkillIds.has(s.id)}
                    onChange={() => toggleSkill(s.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#dadce0] dark:border-[#3c4043]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                      {s.name}
                    </div>
                    <div className="truncate text-xs text-[#70757a]" title={s.path}>
                      {s.id} · {s.path}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Import from folder
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          Absolute path on the server; contents are copied into{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            skills/from-folder/
          </code>{" "}
          under the data root
          .{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">.git</code>{" "}
          and{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            node_modules
          </code>{" "}
          are stripped after copy.
        </p>
        <input
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          placeholder="/absolute/path/to/skills"
          className="mb-3 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
        <button
          type="button"
          disabled={folderBusy}
          onClick={() => void importFolder()}
          className="rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 dark:bg-[#e3e3e3] dark:text-[#1f1f1f] dark:hover:bg-white"
        >
          {folderBusy ? "Importing…" : "Import folder"}
        </button>
      </section>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Extra path (read at chat time)
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          Optional directory to scan for markdown without copying into the global{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            skills/
          </code>{" "}
          folder
          . Leave empty to clear.
        </p>
        <input
          value={runtimePath}
          onChange={(e) => setRuntimePath(e.target.value)}
          placeholder="/optional/extra/skills/dir"
          className="mb-3 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
        <button
          type="button"
          disabled={saveBusy}
          onClick={() => void saveRuntimePath()}
          className="rounded-lg border border-[#dadce0] bg-white px-4 py-2 text-sm font-medium text-[#1f1f1f] hover:bg-[#f1f3f4] disabled:opacity-50 dark:border-[#3c4043] dark:bg-[#1e1f20] dark:text-[#e3e3e3] dark:hover:bg-[#2d2f31]"
        >
          {saveBusy ? "Saving…" : "Save path"}
        </button>
      </section>

      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : null}
      {okMsg ? (
        <p className="text-sm text-[#137333] dark:text-[#81c995]">{okMsg}</p>
      ) : null}
    </div>
  );
}
