"use client";

import { useAssistantRuntime } from "@assistant-ui/react";
import { Settings, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AgentConfig } from "@/lib/agent/agent-store";
import { resolveMainAgentRemoteId } from "@/lib/main-agent-id";

function useMainAgentRemoteId(): string | null {
  const runtime = useAssistantRuntime();
  const [id, setId] = useState<string | null>(null);

  const sync = useCallback(() => {
    setId(resolveMainAgentRemoteId(runtime));
  }, [runtime]);

  useEffect(() => {
    sync();
    const u1 = runtime.threads.subscribe(sync);
    const u2 = runtime.threads.mainItem.subscribe(sync);
    return () => {
      u1();
      u2();
    };
  }, [runtime, sync]);

  return id;
}

export function AgentSettingsTrigger() {
  const runtime = useAssistantRuntime();
  const agentId = useMainAgentRemoteId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const id = resolveMainAgentRemoteId(runtime);
          if (id) setOpen(true);
        }}
        disabled={!agentId}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-2.5 py-1 text-xs font-medium text-[#1f1f1f] shadow-sm transition-colors hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3c4043] dark:bg-[#1e1f20] dark:text-[#e3e3e3] dark:hover:bg-[#2b2c2f]"
        title={agentId ? "Agent settings" : "Select an agent first"}
      >
        <Settings width={14} height={14} aria-hidden />
        Agent settings
      </button>
      {open && agentId ? (
        <AgentSettingsModal
          key={agentId}
          agentId={agentId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Modal body for editing one agent; also used from the agent row ⋮ menu. */
export function AgentSettingsModal({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const runtime = useAssistantRuntime();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    systemPrompt: "",
    maxTokens: "" as string | number,
  });
  const [catalogSkills, setCatalogSkills] = useState<
    Array<{ id: string; name: string; description: string; path: string }>
  >([]);
  const [restrictCatalogSkills, setRestrictCatalogSkills] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [rAgent, rCat] = await Promise.all([
          fetch(`/api/agents/${encodeURIComponent(agentId)}`),
          fetch("/api/skills/catalog"),
        ]);
        if (!rAgent.ok) throw new Error(`Load failed (${rAgent.status})`);
        if (!rCat.ok) throw new Error(`Skills catalog failed (${rCat.status})`);
        const c = (await rAgent.json()) as AgentConfig;
        const catJson = (await rCat.json()) as { skills?: unknown };
        const skills = Array.isArray(catJson.skills)
          ? (catJson.skills as Array<{
              id: string;
              name: string;
              description: string;
              path: string;
            }>)
          : [];
        if (cancelled) return;
        setCatalogSkills(skills);
        const hasRestrict = Array.isArray(c.enabledSkillIds);
        setRestrictCatalogSkills(hasRestrict);
        setSelectedSkillIds(
          hasRestrict
            ? (c.enabledSkillIds ?? [])
            : skills.map((s) => s.id),
        );
        setForm({
          name: c.name,
          systemPrompt: c.systemPrompt ?? "",
          maxTokens: c.maxTokens ?? "",
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim() || "Agent",
        systemPrompt: form.systemPrompt.trim() || null,
      };
      if (form.maxTokens === "" || form.maxTokens === null) {
        body.maxTokens = null;
      } else {
        const n = Number(form.maxTokens);
        if (!Number.isFinite(n) || n < 1) {
          body.maxTokens = null;
        } else {
          body.maxTokens = Math.min(Math.floor(n), 128_000);
        }
      }
      if (!restrictCatalogSkills) {
        body.enabledSkillIds = null;
      } else {
        body.enabledSkillIds = selectedSkillIds;
      }
      const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Save failed (${r.status})`);
      }
      try {
        await runtime.threads.getItemById(agentId).rename(form.name.trim() || "Agent");
      } catch {
        /* sidebar title best-effort */
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal
      aria-labelledby="agent-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-[#f8f9fa] shadow-xl dark:border-[#3c4043] dark:bg-[#1e1f20]">
        <div className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-3 dark:border-[#3c4043]">
          <h2 id="agent-settings-title" className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
            Agent settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#70757a] hover:bg-black/[0.06] dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-4 flex flex-col gap-1">
            <span className="text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
              Agent ID
            </span>
            <code className="break-all rounded-lg border border-[#dadce0] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#1f1f1f] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#bdc1c6]">
              {agentId}
            </code>
          </div>
          {loading ? (
            <p className="text-sm text-[#70757a]">Loading…</p>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  Name
                </span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  System prompt (extra instructions)
                </span>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, systemPrompt: e.target.value }))
                  }
                  rows={5}
                  placeholder="Optional. Merged with the app base prompt for this agent only."
                  className="resize-y rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  Max output tokens
                </span>
                <input
                  type="number"
                  min={1}
                  max={128000}
                  value={form.maxTokens}
                  placeholder="Default (model)"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxTokens: e.target.value === "" ? "" : e.target.value,
                    }))
                  }
                  className="rounded-lg border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
                />
                <span className="text-[11px] text-[#70757a]">
                  Leave empty to use the model default. Cleared on save if blank.
                </span>
              </label>

              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={!restrictCatalogSkills}
                    onChange={(e) => {
                      const all = e.target.checked;
                      setRestrictCatalogSkills(!all);
                      if (all) {
                        setSelectedSkillIds(catalogSkills.map((s) => s.id));
                      }
                    }}
                    className="mt-0.5 rounded border-[#dadce0] dark:border-[#3c4043]"
                  />
                  <span className="text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                    Use all skills from the global catalog (.data/skills)
                  </span>
                </label>
                {restrictCatalogSkills ? (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-[#dadce0] bg-white p-2 dark:border-[#3c4043] dark:bg-[#131314]">
                    <p className="mb-2 text-[11px] text-[#70757a]">
                      Choose which catalog skills this agent may use with find_skills /
                      load_skill. Agent-local skills under this agent&apos;s folder are
                      always available.
                    </p>
                    {catalogSkills.length === 0 ? (
                      <p className="text-xs text-[#70757a]">
                        No SKILL.md entries in .data/skills yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {catalogSkills.map((s) => (
                          <li key={s.id}>
                            <label className="flex cursor-pointer items-start gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={selectedSkillIds.includes(s.id)}
                                onChange={(e) => {
                                  setSelectedSkillIds((prev) =>
                                    e.target.checked
                                      ? [...prev, s.id]
                                      : prev.filter((x) => x !== s.id),
                                  );
                                }}
                                className="mt-0.5 rounded border-[#dadce0] dark:border-[#3c4043]"
                              />
                              <span>
                                <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
                                  {s.name}
                                </span>
                                {s.description ? (
                                  <span className="block text-[11px] text-[#70757a]">
                                    {s.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>

              {err ? (
                <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e8eaed] px-4 py-3 dark:border-[#3c4043]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-[#444746] hover:bg-black/[0.06] dark:text-[#c4c7c5]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="rounded-lg bg-[#1f1f1f] px-4 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50 dark:bg-[#e3e3e3] dark:text-[#1f1f1f] dark:hover:bg-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
