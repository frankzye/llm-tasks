"use client";

import type { ToolCallMessagePartComponent, ToolCallMessagePartProps } from "@assistant-ui/react";
import { Loader2, Puzzle, TriangleAlert } from "lucide-react";

function truncate(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function summarizeResult(result: unknown): { okLabel: string; detail?: string; isError?: boolean } {
  if (result === undefined) return { okLabel: "Running…", detail: undefined };
  if (result === null) return { okLabel: "Completed", detail: "null" };
  if (typeof result === "string") return { okLabel: "Completed", detail: truncate(result, 120) };
  if (typeof result === "number" || typeof result === "boolean") {
    return { okLabel: "Completed", detail: String(result) };
  }
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    const err =
      (typeof r.error === "string" && r.error) ||
      (typeof r.message === "string" && r.message) ||
      undefined;
    if (err) return { okLabel: "Failed", detail: truncate(err, 120), isError: true };
    if (typeof r.ok === "boolean") {
      return r.ok
        ? { okLabel: "Completed" }
        : { okLabel: "Failed", detail: truncate(String(r.error ?? "Error"), 120), isError: true };
    }
    return { okLabel: "Completed" };
  }
  return { okLabel: "Completed" };
}

export const DefaultToolCard: ToolCallMessagePartComponent = ({
  toolName,
  result,
}: ToolCallMessagePartProps) => {
  const summary = summarizeResult(result);
  const loading = result === undefined;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#dadce0] bg-white/90 px-3 py-2.5 shadow-sm dark:border-[#3c4043] dark:bg-[#1e1f20]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#8ab4f8]/10 dark:text-[#8ab4f8]"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : summary.isError ? (
          <TriangleAlert className="size-4" strokeWidth={2.25} />
        ) : (
          <Puzzle className="size-4" strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
          {toolName}
        </p>
        <p className="mt-0.5 truncate text-xs text-[#5f6368] dark:text-[#9aa0a6]">
          {summary.okLabel}
          {summary.detail ? ` — ${summary.detail}` : ""}
        </p>
      </div>
    </div>
  );
};

