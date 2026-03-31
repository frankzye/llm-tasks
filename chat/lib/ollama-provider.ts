import { createOllama } from "ai-sdk-ollama";

/**
 * Ollama provider helper.
 *
 * Defaults to local Ollama endpoint when not configured:
 * - baseURL: `http://localhost:11434`
 *
 * Usage:
 *   const ollama = getOllama();
 *   const model = ollama.chat("qwen3.5:0.8b", { think: true });
 */
export function getOllama(overrides?: { baseURL?: string; apiKey?: string }) {
  const baseURL =
    overrides?.baseURL?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    "http://localhost:11434";
  const apiKey = overrides?.apiKey?.trim() || process.env.OLLAMA_API_KEY?.trim();

  return createOllama({
    baseURL,
    ...(apiKey ? { apiKey } : {}),
  });
}

