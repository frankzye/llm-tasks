"use client";

import { useCallback, useEffect, useState } from "react";

type ProviderKind = "openai" | "ollama" | "deepseek";
type ProviderRow = {
  id: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  modelsText: string;
};

type SettingsApi = {
  modelProviders?: Array<{
    id: string;
    kind: ProviderKind;
    baseUrl?: string | null;
    apiKey?: string | null;
    models: string[];
  }>;
  defaultChatProvider?: string;
  defaultChatModel?: string;
  mem0OpenaiApiKey?: string | null;
  mem0OpenaiBaseUrl?: string | null;
  mem0LlmModel?: string | null;
  mem0EmbedModel?: string | null;
};

export function ModelSettingsTab() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [defaultProvider, setDefaultProvider] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [mem0ApiKey, setMem0ApiKey] = useState("");
  const [mem0BaseUrl, setMem0BaseUrl] = useState("");
  const [mem0LlmModel, setMem0LlmModel] = useState("");
  const [mem0EmbedModel, setMem0EmbedModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const parseModels = (text: string) =>
    [...new Set(text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];

  const kindLabel = (kind: ProviderKind) =>
    kind === "openai" ? "OpenAI-compatible" : kind === "ollama" ? "Ollama" : "DeepSeek";

  const nextProviderId = (kind: ProviderKind, rows: ProviderRow[]) => {
    const base = kind;
    if (!rows.some((r) => r.id === base)) return base;
    let i = 2;
    while (rows.some((r) => r.id === `${base}-${i}`)) i += 1;
    return `${base}-${i}`;
  };

  const providerModelPairs = providers.flatMap((p) =>
    parseModels(p.modelsText).map((m) => ({
      value: `${p.id}::${m}`,
      label: `${p.id} / ${m}`,
      providerId: p.id,
      modelId: m,
    })),
  );

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const s = (await r.json()) as SettingsApi;
      const rows =
        s.modelProviders?.map((p) => ({
          id: p.id,
          kind: p.kind,
          baseUrl: p.baseUrl ?? "",
          apiKey: p.apiKey ?? "",
          modelsText: (p.models ?? []).join("\n"),
        })) ?? [];
      const fallback = rows.length
        ? rows
        : [
            {
              id: "openai",
              kind: "openai" as const,
              baseUrl: "",
              apiKey: "",
              modelsText: "qwen3.5:0.8b",
            },
          ];
      setProviders(fallback);
      const firstProviderId = s.defaultChatProvider ?? fallback[0]?.id ?? "openai";
      setDefaultProvider(firstProviderId);
      const firstModel =
        s.defaultChatModel ?? parseModels(fallback.find((x) => x.id === firstProviderId)?.modelsText ?? "")[0] ?? "";
      setDefaultModel(firstModel);
      setMem0ApiKey(s.mem0OpenaiApiKey ?? "");
      setMem0BaseUrl(s.mem0OpenaiBaseUrl ?? "");
      setMem0LlmModel(s.mem0LlmModel ?? "");
      setMem0EmbedModel(s.mem0EmbedModel ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (providers.length === 0) return;
    if (!providers.some((p) => p.id === defaultProvider)) {
      setDefaultProvider(providers[0]!.id);
      return;
    }
    const models =
      providerModelPairs
        .filter((x) => x.providerId === defaultProvider)
        .map((x) => x.modelId) ?? [];
    if (models.length === 0) return;
    if (!models.includes(defaultModel)) {
      setDefaultModel(models[0]!);
    }
  }, [providers, defaultProvider, defaultModel, providerModelPairs]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const normalizedProviders = providers
        .map((p) => ({
          id: p.id.trim(),
          kind: p.kind,
          baseUrl: p.baseUrl.trim() || null,
          apiKey: p.apiKey.trim() || null,
          models: parseModels(p.modelsText),
        }))
        .filter((p) => p.id && p.models.length > 0);
      if (normalizedProviders.length === 0) {
        throw new Error("Add at least one provider with at least one model.");
      }
      const providerId = defaultProvider.trim() || normalizedProviders[0]!.id;
      const providerModels =
        normalizedProviders.find((p) => p.id === providerId)?.models ?? [];
      const normalizedDefaultModel =
        providerModels.includes(defaultModel.trim())
          ? defaultModel.trim()
          : providerModels[0] || normalizedProviders[0]!.models[0]!;
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelProviders: normalizedProviders,
          defaultChatProvider: providerId,
          defaultChatModel: normalizedDefaultModel,
          mem0OpenaiApiKey: mem0ApiKey.trim() || null,
          mem0OpenaiBaseUrl: mem0BaseUrl.trim() || null,
          mem0LlmModel: mem0LlmModel.trim() || null,
          mem0EmbedModel: mem0EmbedModel.trim() || null,
        }),
      });
      const next = (await r.json()) as SettingsApi & { error?: string };
      if (!r.ok) throw new Error(next.error ?? `Save failed (${r.status})`);
      const nextRows =
        next.modelProviders?.map((p) => ({
          id: p.id,
          kind: p.kind,
          baseUrl: p.baseUrl ?? "",
          apiKey: p.apiKey ?? "",
          modelsText: (p.models ?? []).join("\n"),
        })) ?? providers;
      setProviders(nextRows);
      setDefaultProvider(next.defaultChatProvider ?? providerId);
      setDefaultModel(next.defaultChatModel ?? normalizedDefaultModel);
      setMem0ApiKey(next.mem0OpenaiApiKey ?? "");
      setMem0BaseUrl(next.mem0OpenaiBaseUrl ?? "");
      setMem0LlmModel(next.mem0LlmModel ?? "");
      setMem0EmbedModel(next.mem0EmbedModel ?? "");
      window.dispatchEvent(new Event("settings-updated"));
      setOkMsg("Model settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-sm dark:border-[#3c4043] dark:bg-[#131314]">
      <div className="border-b border-[#e8eaed] px-5 py-4 dark:border-[#34373b]">
        <h2 className="text-base font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
          Model providers
        </h2>
        <p className="mt-1 text-sm text-[#70757a] dark:text-[#9aa0a6]">
          Add one or more providers. Each has its own endpoint, key, and model list.
        </p>
      </div>

      <div className="px-5 py-5">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
              Default provider
            </span>
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} ({p.kind})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
              Default model
            </span>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
            >
              {providerModelPairs
                .filter((x) => x.providerId === defaultProvider)
                .map((x) => (
                  <option key={x.value} value={x.modelId}>
                    {x.modelId}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
              Providers
            </h3>
            <p className="mt-0.5 text-xs text-[#70757a] dark:text-[#9aa0a6]">
              Tip: paste models one-per-line. Provider IDs are auto-generated from the provider kind.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setProviders((prev) => {
                const kind: ProviderKind = "openai";
                return [
                  ...prev,
                  {
                    id: nextProviderId(kind, prev),
                    kind,
                    baseUrl: "",
                    apiKey: "",
                    modelsText: "",
                  },
                ];
              })
            }
            className="shrink-0 rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-sm font-medium text-[#1f1f1f] shadow-sm hover:bg-[#f1f3f4] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-white/10"
          >
            + Add provider
          </button>
        </div>

        <div className="flex flex-col gap-3">
        {providers.map((p, idx) => (
          <div
            key={`${p.id}-${idx}`}
            className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-4 shadow-sm dark:border-[#3c4043] dark:bg-[#0c0c0c]"
          >
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#e8f0fe] px-2 py-0.5 text-[11px] font-semibold text-[#174ea6] dark:bg-[#1e3a5f]/60 dark:text-[#8ab4f8]">
                    {kindLabel(p.kind)}
                  </span>
                  <span className="text-xs text-[#70757a] dark:text-[#9aa0a6]">
                    Provider ID{" "}
                    <code className="rounded bg-black/[0.04] px-1 py-0.5 font-mono text-[11px] text-[#1f1f1f] dark:bg-white/10 dark:text-[#e3e3e3]">
                      {p.id}
                    </code>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProviders((prev) => prev.filter((_, i) => i !== idx))
                }
                className="self-start rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-500/40 dark:bg-[#131314] dark:text-red-300 dark:hover:bg-red-900/20"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                value={p.kind}
                onChange={(e) =>
                  setProviders((prev) => {
                    const nextKind = e.target.value as ProviderKind;
                    const others = prev.filter((_, i) => i !== idx);
                    return prev.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            kind: nextKind,
                            id: nextProviderId(nextKind, others),
                          }
                        : x,
                    );
                  })
                }
                className="rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              >
                <option value="openai">openai</option>
                <option value="ollama">ollama</option>
                <option value="deepseek">deepseek</option>
              </select>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  Base URL
                </span>
                <input
                  value={p.baseUrl}
                  onChange={(e) =>
                    setProviders((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, baseUrl: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder={
                    p.kind === "ollama"
                      ? "http://localhost:11434 (optional)"
                      : "https://… (optional)"
                  }
                  className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  API key
                </span>
                <input
                  type="password"
                  value={p.apiKey}
                  onChange={(e) =>
                    setProviders((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, apiKey: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                Models (one per line)
              </span>
              <textarea
                rows={5}
                value={p.modelsText}
                onChange={(e) =>
                  setProviders((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, modelsText: e.target.value } : x,
                    ),
                  )
                }
                placeholder={"gpt-4.1-mini\nqwen3.5:0.8b"}
                className="w-full resize-y rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 font-mono text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              />
            </label>
          </div>
        ))}
        </div>

        <div className="mt-8 border-t border-[#e8eaed] pt-8 dark:border-[#34373b]">
          <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
            Mem0 (long-term memory)
          </h3>
          <p className="mt-1 text-sm text-[#70757a] dark:text-[#9aa0a6]">
            Optional overrides for embeddings and Mem0’s internal LLM. When empty,{" "}
            <code className="rounded bg-black/[0.06] px-1 font-mono text-xs dark:bg-white/10">
              OPENAI_API_KEY
            </code>
            ,{" "}
            <code className="rounded bg-black/[0.06] px-1 font-mono text-xs dark:bg-white/10">
              OPENAI_BASE_URL
            </code>
            , and{" "}
            <code className="rounded bg-black/[0.06] px-1 font-mono text-xs dark:bg-white/10">
              MEM0_LLM_MODEL
            </code>
            , and{" "}
            <code className="rounded bg-black/[0.06] px-1 font-mono text-xs dark:bg-white/10">
              MEM0_EMBED_MODEL
            </code>{" "}
            from the environment are used. Disable Mem0 with{" "}
            <code className="rounded bg-black/[0.06] px-1 font-mono text-xs dark:bg-white/10">
              MEM0_ENABLED=false
            </code>
            .
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                OpenAI API key (Mem0)
              </span>
              <input
                type="password"
                autoComplete="off"
                value={mem0ApiKey}
                onChange={(e) => setMem0ApiKey(e.target.value)}
                placeholder="Same as OPENAI_API_KEY if unset"
                className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                OpenAI base URL (Mem0)
              </span>
              <input
                value={mem0BaseUrl}
                onChange={(e) => setMem0BaseUrl(e.target.value)}
                placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
                className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                Mem0 LLM model
              </span>
              <input
                value={mem0LlmModel}
                onChange={(e) => setMem0LlmModel(e.target.value)}
                placeholder="e.g. gpt-4.1-mini-2025-04-14 (same as MEM0_LLM_MODEL if unset)"
                className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                Mem0 embedding model
              </span>
              <input
                value={mem0EmbedModel}
                onChange={(e) => setMem0EmbedModel(e.target.value)}
                placeholder="e.g. text-embedding-3-small (same as MEM0_EMBED_MODEL if unset)"
                className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131314] dark:text-[#e3e3e3]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center justify-center rounded-xl bg-[#1a73e8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1557b0] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
          <div className="text-sm">
            {err ? (
              <p className="text-red-600 dark:text-red-400">{err}</p>
            ) : okMsg ? (
              <p className="text-[#137333] dark:text-[#81c995]">{okMsg}</p>
            ) : (
              <p className="text-[#70757a] dark:text-[#9aa0a6]">
                Saved changes apply immediately in the chat model selector.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

