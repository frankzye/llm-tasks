"use client";

import { useCallback, useEffect, useState } from "react";

type SettingsApi = {
  skillsGitUrl?: string;
  skillsGitLastSyncedAt?: string;
  skillsFolderPath?: string | null;
};

export function SkillsSettingsTab() {
  const [settings, setSettings] = useState<SettingsApi | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [runtimePath, setRuntimePath] = useState("");
  const [gitBusy, setGitBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const s = (await r.json()) as SettingsApi;
      setSettings(s);
      setGitUrl(s.skillsGitUrl ?? "");
      setRuntimePath(s.skillsFolderPath ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncGit() {
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
      if (!r.ok) throw new Error(j.error ?? `Sync failed (${r.status})`);
      if (j.settings) setSettings(j.settings);
      setOkMsg("Git skills synced into .data/skills/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGitBusy(false);
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
      setOkMsg("Folder copied into .data/skills/from-folder/");
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
        Global skills are merged for all agents from{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          .data/skills/
        </code>{" "}
        (Git sync merges the repo subfolder into this directory;{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          from-folder/
        </code>{" "}
        is kept). Optional legacy repo{" "}
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          skills/
        </code>
        , and an optional extra directory path below. Per-agent
        <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
          .data/agents/&lt;id&gt;/skills/
        </code>{" "}
        overrides on duplicate skill ids.
      </p>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Load from Git
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
            …/owner/repo/tree/&lt;branch&gt;/&lt;folder/path&gt;
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
            onClick={() => void syncGit()}
            className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
          >
            {gitBusy ? "Cloning…" : "Sync from Git"}
          </button>
          {settings?.skillsGitLastSyncedAt ? (
            <span className="text-xs text-[#70757a]">
              Last synced: {settings.skillsGitLastSyncedAt}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
        <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Import from folder
        </h2>
        <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
          Absolute path on the server; contents are copied into{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            .data/skills/from-folder/
          </code>
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
          Optional directory to scan for markdown without copying into{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            .data/skills/
          </code>
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
