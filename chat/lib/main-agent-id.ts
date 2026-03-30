import type { AssistantRuntime } from "@assistant-ui/react";

/**
 * Resolves the stable agent id for API calls. `mainThreadId` may remain `__LOCALID_*`
 * after a new agent is created, while `remoteId` on the main list item is the real id.
 */
export function resolveMainAgentRemoteId(
  runtime: AssistantRuntime,
): string | null {
  const item = runtime.threads.mainItem.getState();
  if (item.remoteId) return item.remoteId;
  if (item.externalId) return item.externalId;
  const mid = runtime.threads.getState().mainThreadId;
  if (mid && !mid.startsWith("__LOCALID_")) return mid;
  return null;
}
