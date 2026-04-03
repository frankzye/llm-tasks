"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type SettingsApi = {
  cliAlwaysAllowCommands?: string[];
};

export function CliAlwaysAllowTab() {
  const [commands, setCommands] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const s = (await r.json()) as SettingsApi;
      setCommands(s.cliAlwaysAllowCommands ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: string[]) {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliAlwaysAllowCommands: next }),
      });
      const j = (await r.json().catch(() => ({}))) as SettingsApi & {
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `Save failed (${r.status})`);
      setCommands(j.cliAlwaysAllowCommands ?? next);
      window.dispatchEvent(new Event("settings-updated"));
      setOkMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function addOne() {
    const line = draft.trim().replace(/\s+/g, " ");
    if (!line) return;
    const next = [...new Set([...commands, line])];
    setDraft("");
    void persist(next);
  }

  function removeAt(index: number) {
    const next = commands.filter((_, i) => i !== index);
    void persist(next);
  }

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
      <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
        Always-run CLI programs
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
        Program names only (the first token: <code className="text-[11px]">npm</code> from{" "}
        <code className="text-[11px]">npm run dev</code>) skip approval for{" "}
        <code className="text-[11px]">cli_run</code>. You can paste a full command; only the binary
        is stored.
      </p>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addOne();
            }
          }}
          placeholder="e.g. npm or npm run test"
          className="min-w-0 flex-1 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 font-mono text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void addOne()}
          className="shrink-0 rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {commands.length === 0 ? (
        <p className="text-sm text-[#70757a]">
          No programs yet. Add one above or use Always run in chat.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {commands.map((cmd, i) => (
            <li
              key={`${i}-${cmd}`}
              className="flex items-center gap-2 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 dark:border-[#3c4043] dark:bg-[#0c0c0c]"
            >
              <code className="min-w-0 flex-1 break-words font-mono text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                {cmd}
              </code>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAt(i)}
                className="shrink-0 rounded-md p-1.5 text-[#5f6368] hover:bg-black/[0.06] hover:text-red-600 dark:text-[#9aa0a6] dark:hover:bg-white/10 dark:hover:text-red-400"
                aria-label="Remove"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {err ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {okMsg ? (
        <p className="mt-3 text-sm text-[#137333] dark:text-[#81c995]">{okMsg}</p>
      ) : null}
    </div>
  );
}
