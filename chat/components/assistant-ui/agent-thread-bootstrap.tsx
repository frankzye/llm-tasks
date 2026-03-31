"use client";

import { useAssistantRuntime } from "@assistant-ui/react";
import { useEffect } from "react";

/**
 * Remote thread list starts on a placeholder `__LOCALID_*` thread. After agents load from
 * the server, switch to the first real agent once so we don't create a second agent by mistake.
 *
 * Module-level (not ref): a ref resets on remount and would re-run this logic when the user
 * clicks "New agent" (main becomes `__LOCALID_*` again), stealing the draft back to the first agent.
 */
let placeholderBootstrapDone = false;

export function AgentThreadBootstrap() {
  const runtime = useAssistantRuntime();

  useEffect(() => {
    const trySwitch = () => {
      if (placeholderBootstrapDone) return;
      const s = runtime.threads.getState();
      if (s.isLoading) return;
      if (s.threadIds.length === 0) return;
      if (!s.mainThreadId?.startsWith("__LOCALID_")) {
        placeholderBootstrapDone = true;
        return;
      }
      placeholderBootstrapDone = true;
      void runtime.threads.switchToThread(s.threadIds[0]);
    };

    const unsub = runtime.threads.subscribe(trySwitch);
    trySwitch();
    return unsub;
  }, [runtime]);

  return null;
}
