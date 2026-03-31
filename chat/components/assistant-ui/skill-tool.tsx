"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { BookOpen, Loader2, TriangleAlert } from "lucide-react";
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

type LoadSkillResult =
  | { error: string }
  | { id: string; title?: string; tags?: string[]; body?: string };

export const LoadSkillTool: ToolCallMessagePartComponent<
  { skillId?: string },
  LoadSkillResult
> = ({ args, argsText, result }) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const requestedId = typeof a.skillId === "string" ? a.skillId : "";

  const loading = result === undefined;
  const isError =
    !!result &&
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as { error?: unknown }).error === "string";

  const loaded =
    !!result && typeof result === "object" && result !== null && !isError
      ? (result as { id?: string; title?: string; tags?: string[] })
      : null;

  const label = loading
    ? "Loading skill…"
    : isError
      ? "Skill load failed"
      : "Skill loaded";

  const subtitle = loading
    ? requestedId
      ? `skillId: ${requestedId}`
      : undefined
    : isError
      ? truncate((result as { error: string }).error, 140)
      : loaded
        ? `${loaded.title ?? loaded.id ?? requestedId ?? ""}`.trim()
        : undefined;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-white px-3 py-2.5 shadow-sm dark:border-emerald-500/25 dark:from-emerald-950/35 dark:to-[#1a1b1e]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : isError ? (
          <TriangleAlert className="size-4" strokeWidth={2.25} />
        ) : (
          <BookOpen className="size-4" strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
          {label}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-[#5f6368] dark:text-[#9aa0a6]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
};

