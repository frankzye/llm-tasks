"use client";

import { useCallback, useEffect, useState } from "react";

type SettingsApi = {
  chatModels?: string[];
  defaultChatModel?: string;
  provider?: "openai" | "ollama" | "deepseek";
  providerBaseUrl?: string | null;
  providerApiKey?: string | null;
};

export function ModelSettingsTab() {
  const [modelsText, setModelsText] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [provider, setProvider] = useState<"openai" | "ollama" | "deepseek">("openai");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const parseModels = (text: string) =>
    [...new Set(text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean))];

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const s = (await r.json()) as SettingsApi;
      const models = s.chatModels ?? [];
      setModelsText(models.join("\n"));
      setDefaultModel(s.defaultChatModel ?? models[0] ?? "");
      setProvider(s.provider ?? "openai");
      setProviderBaseUrl(s.providerBaseUrl ?? "");
      setProviderApiKey(s.providerApiKey ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const models = parseModels(modelsText);
      if (models.length === 0) {
        throw new Error("Add at least one model id.");
      }
      const normalizedDefault = defaultModel.trim() || models[0];
      if (!models.includes(normalizedDefault)) {
        throw new Error("Default model must be one of the model ids.");
      }
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatModels: models,
          defaultChatModel: normalizedDefault,
          provider,
          providerBaseUrl: providerBaseUrl.trim() || null,
          providerApiKey: providerApiKey.trim() || null,
        }),
      });
      const next = (await r.json()) as SettingsApi & { error?: string };
      if (!r.ok) throw new Error(next.error ?? `Save failed (${r.status})`);
      setModelsText((next.chatModels ?? models).join("\n"));
      setDefaultModel(next.defaultChatModel ?? normalizedDefault);
      setProvider(next.provider ?? provider);
      setProviderBaseUrl(next.providerBaseUrl ?? providerBaseUrl);
      setProviderApiKey(next.providerApiKey ?? providerApiKey);
      setOkMsg("Model settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#3c4043] dark:bg-[#131314]">
      <h2 className="mb-3 text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">
        Chat models
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-[#70757a]">
        One model id per line. These ids are shown in the chat model selector and
        accepted by the server.
      </p>
      <textarea
        rows={6}
        value={modelsText}
        onChange={(e) => setModelsText(e.target.value)}
        placeholder={"qwen3.5:0.8b\nopenai/gpt-4o-mini"}
        className="mb-3 w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 font-mono text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
      />
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
          Provider
        </span>
        <select
          value={provider}
          onChange={(e) =>
            setProvider(e.target.value as "openai" | "ollama" | "deepseek")
          }
          className="w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        >
          <option value="openai">openai</option>
          <option value="ollama">ollama</option>
          <option value="deepseek">deepseek</option>
        </select>
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
          Provider base URL
        </span>
        <input
          value={providerBaseUrl}
          onChange={(e) => setProviderBaseUrl(e.target.value)}
          placeholder={
            provider === "ollama"
              ? "http://localhost:11434"
              : provider === "deepseek"
                ? "https://api.deepseek.com"
                : "https://api.openai.com/v1"
          }
          className="w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
          Provider API key
        </span>
        <input
          type="password"
          value={providerApiKey}
          onChange={(e) => setProviderApiKey(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
          Default model
        </span>
        <input
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="Model id from list above"
          className="w-full rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:ring-2 focus:ring-[#1a73e8] dark:border-[#3c4043] dark:bg-[#0c0c0c] dark:text-[#e3e3e3]"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1557b0] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save models"}
      </button>
      {err ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {okMsg ? (
        <p className="mt-3 text-sm text-[#137333] dark:text-[#81c995]">{okMsg}</p>
      ) : null}
    </div>
  );
}

