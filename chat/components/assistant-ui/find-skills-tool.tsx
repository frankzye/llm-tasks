"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { useMemo } from "react";

function parseArgs(argsText: string, args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && args !== null) return args as Record<string, unknown>;
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

type FindSkillsArgs = { query?: string };
type FindSkillsResult =
  | { hits?: unknown; skillsInventory?: unknown; error?: string; message?: string }
  | string;

function getArrayLen(x: unknown): number | null {
  return Array.isArray(x) ? x.length : null;
}

export const FindSkillsTool: ToolCallMessagePartComponent<FindSkillsArgs, FindSkillsResult> = ({
  args,
  argsText,
  result,
}) => {
  const a = useMemo(() => parseArgs(argsText, args), [argsText, args]);
  const query = typeof a.query === "string" ? a.query.trim() : "";

  const loading = result === undefined;
  const errMsg =
    !loading &&
    result &&
    typeof result === "object" &&
    ("error" in result || "message" in result) &&
    typeof (result as { error?: unknown; message?: unknown }).error === "string"
      ? String((result as { error?: unknown }).error)
      : !loading &&
          result &&
          typeof result === "object" &&
          typeof (result as { message?: unknown }).message === "string" &&
          String((result as { message?: unknown }).message).toLowerCase().includes("error")
        ? String((result as { message?: unknown }).message)
        : null;

  const { hitsLen, invLen } = useMemo(() => {
    if (loading) return { hitsLen: null as number | null, invLen: null as number | null };
    if (!result || typeof result !== "object") return { hitsLen: null, invLen: null };
    const r = result as Record<string, unknown>;
    return {
      hitsLen: getArrayLen(r.hits),
      invLen: getArrayLen(r.skillsInventory),
    };
  }, [loading, result]);

  const label = loading ? "Searching skills…" : errMsg ? "Skill search failed" : "Skills found";

  const subtitle = loading
    ? query
      ? `query: ${truncate(query, 90)}`
      : "query: (none)"
    : errMsg
      ? truncate(errMsg, 140)
      : typeof hitsLen === "number"
        ? `${hitsLen} match${hitsLen === 1 ? "" : "es"}`
        : typeof invLen === "number"
          ? `${invLen} available`
          : "Completed";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#dadce0] bg-white/90 px-3 py-2.5 shadow-sm dark:border-[#3c4043] dark:bg-[#1e1f20]">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
        aria-hidden
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        ) : errMsg ? (
          <TriangleAlert className="size-4" strokeWidth={2.25} />
        ) : (
          <Search className="size-4" strokeWidth={2.25} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight text-[#1f1f1f] dark:text-[#e8eaed]">
          find_skills
        </p>
        <p className="mt-0.5 truncate text-xs text-[#5f6368] dark:text-[#9aa0a6]">
          {label}
          {subtitle ? ` — ${subtitle}` : ""}
        </p>
      </div>
    </div>
  );
};

