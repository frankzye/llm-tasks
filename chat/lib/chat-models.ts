import type { GlobalSettings } from "@/lib/global-settings";
import type { ModelProviderConfig, ProviderKind } from "@/lib/global-settings";

/** Built-in fallback when settings do not define models yet. */
export const FALLBACK_CHAT_MODELS = ["qwen3.5:0.8b"] as const;
export const FALLBACK_DEFAULT_CHAT_MODEL = "qwen3.5:0.8b";

export type ProviderModelOption = {
  providerId: string;
  providerKind: ProviderKind;
  modelId: string;
};

function normalizeProviderConfigs(settings: GlobalSettings): ModelProviderConfig[] {
  const rows = settings.modelProviders ?? [];
  const clean = rows
    .map((p) => ({
      id: p.id.trim(),
      kind: p.kind,
      baseUrl: p.baseUrl ?? null,
      apiKey: p.apiKey ?? null,
      models: [...new Set((p.models ?? []).map((m) => m.trim()).filter(Boolean))],
    }))
    .filter((p) => p.id && p.models.length > 0);
  if (clean.length > 0) return clean;
  return [
    {
      id: settings.provider ?? "openai",
      kind: settings.provider ?? "openai",
      baseUrl: settings.providerBaseUrl ?? null,
      apiKey: settings.providerApiKey ?? null,
      models: getChatModelsFromSettings(settings),
    },
  ];
}

export function getProviderModelOptions(
  settings: GlobalSettings,
): ProviderModelOption[] {
  return normalizeProviderConfigs(settings).flatMap((p) =>
    p.models.map((modelId) => ({
      providerId: p.id,
      providerKind: p.kind,
      modelId,
    })),
  );
}

export function getChatModelsFromSettings(settings: GlobalSettings): string[] {
  const fromProviders = getProviderModelOptions(settings).map((x) => x.modelId);
  if (fromProviders.length > 0) return [...new Set(fromProviders)];
  const fromSettings = settings.chatModels?.map((m) => m.trim()).filter(Boolean) ?? [];
  if (fromSettings.length > 0) return [...new Set(fromSettings)];
  return [...FALLBACK_CHAT_MODELS];
}

export function getDefaultChatModelFromSettings(settings: GlobalSettings): string {
  const models = getChatModelsFromSettings(settings);
  const preferred = settings.defaultChatModel?.trim();
  if (preferred && models.includes(preferred)) return preferred;
  return models[0] ?? FALLBACK_DEFAULT_CHAT_MODEL;
}

export function isAllowedChatModel(id: string, settings: GlobalSettings): boolean {
  return getChatModelsFromSettings(settings).includes(id);
}

export function findProviderById(settings: GlobalSettings, providerId?: string | null) {
  const all = normalizeProviderConfigs(settings);
  if (providerId) {
    const exact = all.find((p) => p.id === providerId);
    if (exact) return exact;
  }
  const preferredDefault = settings.defaultChatProvider?.trim();
  if (preferredDefault) {
    const byDefault = all.find((p) => p.id === preferredDefault);
    if (byDefault) return byDefault;
  }
  return all[0];
}
