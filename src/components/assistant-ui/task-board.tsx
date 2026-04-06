"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/ui/button";
import { useMainAgentRemoteId } from "@/src/lib/use-main-agent-remote-id";

type TaskBoardState = {
  tasks: { id: string; title: string; done: boolean }[];
};

const initial: TaskBoardState = { tasks: [] };

/**
 * Right-sidebar task list for the current agent. Persists via
 * `GET`/`PUT` `/api/agents/[id]/task-board` (same file as `read_task_board` /
 * `update_task_board` in chat). Not rendered inside the message stream.
 */
export function TaskBoard() {
  const remoteAgentId = useMainAgentRemoteId();
  const [state, setState] = useState<TaskBoardState>(initial);
  const loadedKeyRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (agentId: string) => {
    setLoadError(null);
    const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/task-board`);
    if (!r.ok) throw new Error(`Load failed (${r.status})`);
    const data = (await r.json()) as TaskBoardState;
    setState({
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
    });
    loadedKeyRef.current = agentId;
  }, []);

  useEffect(() => {
    if (!remoteAgentId) {
      loadedKeyRef.current = null;
      setState(initial);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await load(remoteAgentId);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remoteAgentId, load]);

  /** Keep UI in sync when the assistant updates tasks via chat tools (no server push). */
  useEffect(() => {
    if (!remoteAgentId) return;
    const t = window.setInterval(() => {
      void load(remoteAgentId).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(t);
  }, [remoteAgentId, load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && remoteAgentId) {
        void load(remoteAgentId).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [remoteAgentId, load]);

  useEffect(() => {
    if (!remoteAgentId) return;
    if (loadedKeyRef.current !== remoteAgentId) return;
    const t = window.setTimeout(() => {
      void fetch(`/api/agents/${encodeURIComponent(remoteAgentId)}/task-board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch((e) => {
        console.error("[task-board] save failed", e);
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [state, remoteAgentId]);

  const clearBoard = useCallback(() => {
    setState({ tasks: [] });
  }, []);

  const onRefresh = useCallback(async () => {
    if (!remoteAgentId) return;
    setRefreshing(true);
    try {
      await load(remoteAgentId);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [remoteAgentId, load]);

  if (!remoteAgentId) {
    return (
      <div className="flex h-full min-h-0 flex-col border-l border-[#e8eaed] bg-[#fafafa] p-3 dark:border-[#3c4043] dark:bg-[#0c0c0c]">
        <p className="text-xs text-[#70757a] dark:text-[#9aa0a6]">
          Create or select a saved agent to use the task board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-[#e8eaed] bg-[#fafafa] dark:border-[#3c4043] dark:bg-[#0c0c0c]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#e8eaed] px-3 py-2 dark:border-[#3c4043]">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]">
            Task board
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[#70757a] dark:text-[#80868b]">
            Synced to disk; the assistant can also use read_task_board / update_task_board.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-[#5f6368] hover:text-[#1f1f1f] dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3]"
            title="Refresh from server"
            disabled={refreshing}
            onClick={() => void onRefresh()}
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {state.tasks.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="shrink-0 text-[#5f6368] hover:text-[#1f1f1f] dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3]"
              onClick={clearBoard}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>
      {loadError ? (
        <p className="px-3 py-2 text-xs text-[#c5221f] dark:text-[#f28b82]">
          {loadError}
        </p>
      ) : null}
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.tasks.length === 0 ? (
          <li className="rounded-lg border border-dashed border-[#dadce0] px-3 py-6 text-center text-xs text-[#70757a] dark:border-[#3c4043] dark:text-[#9aa0a6]">
            No tasks yet. Ask the assistant to add one, or add tasks via chat tools.
          </li>
        ) : (
          state.tasks.map((task) => {
            const done = task.done ?? false;
            return (
              <li
                key={task.id}
                className="mb-1.5 flex items-start gap-1 rounded-lg border border-[#e8eaed] bg-white px-2 py-2 text-sm dark:border-[#3c4043] dark:bg-[#131314]"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-[#dadce0] dark:border-[#5f6368]"
                    checked={done}
                    onChange={() =>
                      setState((prev) => ({
                        tasks: prev.tasks.map((t) =>
                          t.id === task.id
                            ? { ...t, done: !(t.done ?? false) }
                            : t,
                        ),
                      }))
                    }
                  />
                  <span
                    className={
                      done
                        ? "text-[#70757a] line-through dark:text-[#9aa0a6]"
                        : "text-[#1f1f1f] dark:text-[#e3e3e3]"
                    }
                  >
                    {task.title ?? ""}
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-[#70757a] hover:text-[#c5221f] dark:text-[#9aa0a6] dark:hover:text-[#f28b82]"
                  aria-label="Delete task"
                  onClick={() =>
                    setState((prev) => ({
                      tasks: prev.tasks.filter((t) => t.id !== task.id),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
