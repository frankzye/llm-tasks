import { createDeepSeek } from "@ai-sdk/deepseek";

/**
 * DeepSeek provider helper.
 *
 * Uses explicit overrides first, then env vars:
 * - DEEPSEEK_BASE_URL
 * - DEEPSEEK_API_KEY
 */
export function getDeepSeek(overrides?: { baseURL?: string; apiKey?: string }) {
  const baseURL = overrides?.baseURL?.trim() || process.env.DEEPSEEK_BASE_URL?.trim();
  const apiKey = overrides?.apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();

  return createDeepSeek({
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
  });
}
