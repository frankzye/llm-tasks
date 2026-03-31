import { createOpenAI, } from "@ai-sdk/openai";

/**
 * OpenAI-compatible provider. Set `OPENAI_BASE_URL` for a custom gateway or proxy
 * (must be the API root, typically ending in `/v1`).
 *
 * Use `getOpenAI().chat(modelId)` for chat (Ollama, LM Studio, etc.). The bare
 * `getOpenAI()(modelId)` shortcut targets OpenAI’s Responses API and is not compatible
 * with most local servers.
 */
export function getOpenAI(overrides?: { baseURL?: string; apiKey?: string }) {
  const baseURL = overrides?.baseURL?.trim() || process.env.OPENAI_BASE_URL?.trim();
  const apiKey = overrides?.apiKey?.trim() || process.env.OPENAI_API_KEY;
  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}
