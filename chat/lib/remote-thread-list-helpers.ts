import type { AssistantRuntime } from "@assistant-ui/react";

type RemoteThreadListCoreInternals = {
  _loadThreadsPromise?: Promise<void>;
  getLoadThreadsPromise(): Promise<void>;
  __internal_load(): void;
};

/**
 * `RemoteThreadListThreadListRuntimeCore` only runs `adapter.list()` once (cached promise).
 * After creating an agent via POST, we must clear that cache so the new thread id appears
 * and `switchToThread(remoteId)` can resolve.
 *
 * Depends on @assistant-ui/react internals — revisit on major upgrades.
 */
export function reloadRemoteThreadList(runtime: AssistantRuntime): Promise<void> {
  const listCore = (
    runtime as unknown as { _core: { threads: RemoteThreadListCoreInternals } }
  )._core.threads;
  listCore._loadThreadsPromise = undefined;
  listCore.__internal_load();
  return listCore.getLoadThreadsPromise();
}

export async function createAgentOnServer(name = "Agent"): Promise<{ id: string }> {
  const r = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(`create agent failed: ${r.status}`);
  const j = (await r.json()) as { id: string };
  if (!j.id) throw new Error("create agent: missing id");
  return j;
}
