import type { GlobalSettings } from "@/lib/global-settings";

/** Built-in fallback when settings do not define models yet. */
export const FALLBACK_CHAT_MODELS = ["qwen3.5:0.8b"] as const;
export const FALLBACK_DEFAULT_CHAT_MODEL = "qwen3.5:0.8b";

export function getChatModelsFromSettings(settings: GlobalSettings): string[] {
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
