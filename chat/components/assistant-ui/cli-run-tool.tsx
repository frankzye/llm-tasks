"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { Check, Copy, Loader2, Terminal, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type CliArgs = { command?: string };

function parseCommand(
  args: unknown,
  argsText: string,
): string {
  if (args && typeof args === "object" && args !== null) {
    const c = (args as CliArgs).command;
    if (typeof c === "string") return c;
  }
  try {
    const j = JSON.parse(argsText) as { command?: string };
    if (typeof j.command === "string") return j.command;
  } catch {
    /* ignore */
  }
  return argsText;
}

type ResultShape =
  | { status: "completed"; output: string }
  | { status: "pending_approval"; command: string }
  | { status: "error"; message: string };

function normalizeResult(result: unknown): ResultShape | null {
  if (result === undefined || result === null) return null;
  if (typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (r.status === "completed" && typeof r.output === "string") {
    return { status: "completed", output: r.output };
  }
  if (r.status === "pending_approval" && typeof r.command === "string") {
    return { status: "pending_approval", command: r.command };
  }
  if (r.status === "error" && typeof r.message === "string") {
    return { status: "error", message: r.message };
  }
  if (typeof r.output === "string" && r.status === undefined) {
    return { status: "completed", output: r.output };
  }
  return null;
}

/**
 * Cursor-style CLI card: allowlisted runs show output; non-allowlisted show Run / Skip
 * before calling `/api/cli/execute` (see [assistant-ui Tools](https://www.assistant-ui.com/docs/guides/tools)).
 */
export const CliRunTool: ToolCallMessagePartComponent<CliArgs, ResultShape> = ({
  args,
  argsText,
  result,
}) => {
  const command = useMemo(() => parseCommand(args, argsText), [args, argsText]);
  const initial = normalizeResult(result);

  const [approvedOutput, setApprovedOutput] = useState<string | null>(null);
  const [approvedError, setApprovedError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  const runApproved = useCallback(async () => {
    setLoading(true);
    setApprovedError(null);
    try {
      const res = await fetch("/api/cli/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, approved: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        output?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setApprovedError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setApprovedOutput(typeof data.output === "string" ? data.output : "");
    } catch (e) {
      setApprovedError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [command]);

  const copyCmd = useCallback(() => {
    void navigator.clipboard.writeText(command);
  }, [command]);

  const copyOut = useCallback(
    (text: string) => {
      void navigator.clipboard.writeText(text);
    },
    [],
  );

  const completedOutput =
    initial?.status === "completed"
      ? initial.output
      : approvedOutput !== null
        ? approvedOutput
        : null;

  const showPendingCard =
    initial?.status === "pending_approval" &&
    approvedOutput === null &&
    !skipped &&
    !loading;

  const errMsg =
    initial?.status === "error"
      ? initial.message
      : approvedError;

  return (
    <div className="overflow-hidden rounded-xl border border-[#2d333b] bg-[#0d1117] text-left shadow-lg dark:border-[#30363d]">
      <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#161b22] px-3 py-2">
        <Terminal className="size-4 shrink-0 text-[#58a6ff]" aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-[#c9d1d9]">
          CLI
        </span>
        <span className="ml-auto text-[10px] font-medium uppercase text-[#8b949e]">
          sandbox
        </span>
      </div>

      <div className="px-3 py-2">
        <div className="mb-2 flex items-start gap-2">
          <code className="min-w-0 flex-1 wrap-break-word rounded-md bg-[#21262d] px-2.5 py-2 font-mono text-[13px] leading-snug text-[#79c0ff]">
            {command || "(no command)"}
          </code>
          <button
            type="button"
            onClick={copyCmd}
            className="shrink-0 rounded-md p-1.5 text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#c9d1d9]"
            title="Copy command"
          >
            <Copy className="size-4" />
          </button>
        </div>

        {initial?.status === "error" ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-2 font-mono text-xs text-red-300">
            {initial.message}
          </p>
        ) : null}

        {errMsg ? (
          <p className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-2 font-mono text-xs text-red-300">
            {errMsg}
          </p>
        ) : null}

        {showPendingCard ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <p className="w-full text-xs text-[#8b949e]">
              This command is not in the auto-allow list. Run it in the isolated
              temp sandbox?
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runApproved()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#238636] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Run
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setSkipped(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition-colors hover:bg-[#30363d] disabled:opacity-50"
            >
              <X className="size-3.5" />
              Skip
            </button>
          </div>
        ) : null}

        {skipped ? (
          <p className="pt-2 text-xs italic text-[#8b949e]">Skipped by user.</p>
        ) : null}

        {loading && initial?.status === "pending_approval" ? (
          <p className="flex items-center gap-2 pt-2 text-xs text-[#8b949e]">
            <Loader2 className="size-3.5 animate-spin" />
            Running in sandbox…
          </p>
        ) : null}

        {completedOutput !== null && !showPendingCard ? (
          <div className="mt-2 border-t border-[#30363d] pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-[#8b949e]">
                Output
              </span>
              <button
                type="button"
                onClick={() => copyOut(completedOutput)}
                className="text-[10px] text-[#58a6ff] hover:underline"
              >
                Copy
              </button>
            </div>
            <pre className="max-h-64 overflow-auto wrap-break-word rounded-md bg-[#010409] p-2.5 font-mono text-[12px] leading-relaxed text-[#c9d1d9]">
              {completedOutput || "(empty)"}
            </pre>
          </div>
        ) : null}

        {result === undefined && !initial ? (
          <p className="text-xs text-[#8b949e]">Waiting for result…</p>
        ) : null}
      </div>
    </div>
  );
};
