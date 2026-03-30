/** Shared client/server allowlist for OpenAI chat models. */
export const CHAT_MODELS = [
  { id: "qwen3.5:0.8b", label: "Ollama Qwen3.5 0.8b" },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]["id"];

export const DEFAULT_CHAT_MODEL: ChatModelId = "qwen3.5:0.8b";

export function isAllowedChatModel(id: string): id is ChatModelId {
  return CHAT_MODELS.some((m) => m.id === id);
}
