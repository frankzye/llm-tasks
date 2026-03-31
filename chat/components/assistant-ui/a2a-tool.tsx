"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
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

type A2AResult =
  | { delivered: true; messageId?: string; note?: string }
  | { delivered?: false; error?: string }
  | { error?: string };

export const A2ASendTool: ToolCallMessagePartComponent<
  { targetAgentId?: string; message?: string; correlationId?: string },
  A2AResult
> = ({ args, argsText, result }) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const target =
    typeof a.targetAgentId === "string" ? a.targetAgentId : "";
  const msg =
    typeof a.message === "string" ? a.message : "";

  const loading = result === undefined;
  const isError =
    !!result &&
    typeof result === "object" &&
    result !== null &&
    (("error" in result && typeof (result as { error?: unknown }).error === "string") ||
      ("delivered" in result && (result as { delivered?: unknown }).delivered === false));

  const delivered =
    !!result &&
    typeof result === "object" &&
    result !== null &&
    "delivered" in result &&
    (result as { delivered?: unknown }).delivered === true;

  const label = loading
    ? "Sending…"
    : delivered
      ? "Sent via A2A"
      : "A2A send failed";

  const subtitle = loading
    ? target
      ? `to: ${target}`
      : undefined
    : delivered
      ? target
        ? `to: ${target}`
        : "Delivered"
      : result && typeof result === "object" && result !== null && "error" in result
        ? truncate(String((result as { error?: string }).error ?? "Error"), 140)
        : "Error";

  const detail = !loading && msg ? truncate(msg, 120) : null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 to-white px-3 py-2.5 shadow-sm dark:border-indigo-500/25 dark:from-indigo-950/35 dark:to-[#1a1b1e]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : isError ? (
          <TriangleAlert className="size-4" strokeWidth={2.25} />
        ) : (
          <Send className="size-4" strokeWidth={2.25} />
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
        {!loading && detail ? (
          <p className="mt-0.5 truncate text-[11px] text-[#70757a] dark:text-[#9aa0a6]">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
};

