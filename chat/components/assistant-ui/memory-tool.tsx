"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { BookmarkPlus, Loader2, Search } from "lucide-react";
import { useMemo } from "react";

function parseArgs(argsText: string, args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && args !== null) {
    return args as Record<string, unknown>;
  }
  try {
    return JSON.parse(argsText) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

type StoreResult = { ok?: boolean; error?: string };

export const MemoryStoreTool: ToolCallMessagePartComponent<
  { content?: string },
  StoreResult
> = ({ args, argsText, result }) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const content =
    typeof a.content === "string" ? a.content : "";

  const loading = result === undefined;
  const ok =
    result !== undefined &&
    typeof result === "object" &&
    result !== null &&
    (result as StoreResult).ok === true;
  const errMsg =
    result !== undefined &&
    typeof result === "object" &&
    result !== null &&
    (result as StoreResult).ok === false
      ? String((result as StoreResult).error ?? "Error")
      : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50/90 to-white px-3 py-2.5 shadow-sm dark:border-violet-500/25 dark:from-violet-950/40 dark:to-[#1a1b1e]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : (
          <BookmarkPlus className="size-4" strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
          {loading
            ? "Saving to memory…"
            : ok
              ? "Saved to memory"
              : "Memory save failed"}
        </p>
        {!loading && content ? (
          <p className="mt-0.5 text-xs leading-snug text-[#5f6368] dark:text-[#9aa0a6]">
            {truncate(content, 140)}
          </p>
        ) : null}
        {!loading && errMsg ? (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400/90">
            {truncate(errMsg, 100)}
          </p>
        ) : null}
      </div>
    </div>
  );
};

type RecallEntry = { key?: string; value?: string; updatedAt?: string };
type RecallResult = {
  entries?: RecallEntry[];
  error?: string;
};

export const MemoryRecallTool: ToolCallMessagePartComponent<
  { query?: string; limit?: number },
  RecallResult
> = ({ args, argsText, result }) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const query = typeof a.query === "string" ? a.query : "";

  const loading = result === undefined;
  const data =
    result !== undefined && typeof result === "object" && result !== null
      ? (result as RecallResult)
      : null;
  const entries = data?.entries ?? [];
  const err = data?.error;
  const count = entries.length;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/90 to-white px-3 py-2.5 shadow-sm dark:border-sky-500/25 dark:from-sky-950/35 dark:to-[#1a1b1e]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : (
          <Search className="size-4" strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
          {loading ? "Searching memory…" : "Memory search"}
        </p>
        {query ? (
          <p className="mt-0.5 truncate text-xs text-[#5f6368] dark:text-[#9aa0a6]">
            “{truncate(query, 80)}”
          </p>
        ) : null}
        {!loading && !err && (
          <p className="mt-0.5 text-xs font-medium text-sky-800/90 dark:text-sky-300/90">
            {count === 0
              ? "No matching memories"
              : `${count} ${count === 1 ? "memory" : "memories"} found`}
          </p>
        )}
        {!loading && err ? (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400/90">
            {truncate(String(err), 100)}
          </p>
        ) : null}
      </div>
    </div>
  );
};
