import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** When unset, use the official API root so URL resolution never sees an empty base (ERR_INVALID_URL on `/chat/completions`). */
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";

/**
 * OpenAI-compatible provider. Set `OPENAI_BASE_URL` (or settings base URL) for a
 * custom gateway; value must be an absolute URL, typically ending in `/v1`.
 *
 * Use `getOpenAI().chat(modelId)` for chat (Ollama, LM Studio, etc.). The bare
 * `getOpenAI()(modelId)` shortcut targets OpenAI’s Responses API and is not compatible
 * with most local servers.
 */
export function getOpenAI(overrides?: { baseURL?: string; apiKey?: string }) {
  const raw =
    overrides?.baseURL?.trim() || process.env.OPENAI_BASE_URL?.trim();
  const baseURL = raw || DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
  const apiKey = overrides?.apiKey?.trim() || process.env.OPENAI_API_KEY;
  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL,
    apiKey,
  });
}
