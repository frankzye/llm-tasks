"use client";

import { useAui, useAuiState } from "@assistant-ui/react";
import { useEffect } from "react";

/**
 * Remote thread list starts on a placeholder `__LOCALID_*` thread. After agents load from
 * the server, switch to the first real agent once so we don't create a second agent by mistake.
 *
 * Track per runtime instance:
 * - keeps "new agent draft" behavior intact within the same runtime
 * - still re-runs when the user leaves and comes back (new runtime instance)
 */
const bootstrappedRuntimes = new WeakSet<object>();

export function AgentThreadBootstrap() {
  const aui = useAui();
  const isLoading = useAuiState((s) => s.threads.isLoading);
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);

  useEffect(() => {
    const threads = aui.threads();
    const runtime = threads.__internal_getAssistantRuntime?.();
    if (!runtime) return;

    if (bootstrappedRuntimes.has(runtime as object)) return;
    if (isLoading) return;
    if (threadIds.length === 0) return;
    if (!mainThreadId?.startsWith("__LOCALID_")) {
      bootstrappedRuntimes.add(runtime as object);
      return;
    }
    bootstrappedRuntimes.add(runtime as object);
    void threads.switchToThread(threadIds[0]);
  }, [aui, isLoading, mainThreadId, threadIds]);

  return null;
}
