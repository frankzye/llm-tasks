"use client";

import {
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { BookmarkPlus, Check, Loader2, TerminalSquare, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useToolApprovalResponse } from "@/src/lib/tool-approval-response-context";
import {
  getToolApprovalIdForCall,
  subscribeToolApprovalIndex,
} from "@/src/lib/tool-approval-index-store";

function normalizeTerminalText(text: string): string {
  let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  try {
    const decoded = JSON.parse(`"${normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
    normalized = decoded;
  } catch {
    // Keep raw text when escape decoding is not applicable.
  }
  return normalized;
}

function formatOutput(result: unknown): string {
  if (result === undefined) return "Running...";
  if (typeof result === "string") return normalizeTerminalText(result);
  if (result === null) return "null";
  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  if (typeof result === "object") {
    const rec = result as Record<string, unknown>;
    if (typeof rec.output === "string") {
      return normalizeTerminalText(rec.output);
    }
    if (typeof rec.stdout === "string" || typeof rec.stderr === "string") {
      const stdout =
        typeof rec.stdout === "string" ? normalizeTerminalText(rec.stdout) : "";
      const stderr =
        typeof rec.stderr === "string" ? normalizeTerminalText(rec.stderr) : "";
      const exitCode =
        typeof rec.exitCode === "number" ? `\n(exit code: ${rec.exitCode})` : "";
      if (stdout || stderr) {
        return `${stdout}${stderr ? `${stdout ? "\n" : ""}${stderr}` : ""}${exitCode}`;
      }
    }
  }
  try {
    return normalizeTerminalText(JSON.stringify(result, null, 2));
  } catch {
    return String(result);
  }
}

function commandFromArgsObject(args: unknown): string | null {
  if (!args) return null;
  if (typeof args === "string") return normalizeTerminalText(args);
  if (typeof args !== "object") return null;
  const rec = args as Record<string, unknown>;
  const value = rec.command ?? rec.cmd ?? rec.input;
  if (typeof value === "string" && value.trim().length > 0) {
    return normalizeTerminalText(value);
  }
  return null;
}

/** During approval, `args` is sometimes empty; `argsText` has the JSON tool input. */
function extractCommand(args: unknown, argsText?: string): string | null {
  const direct = commandFromArgsObject(args);
  if (direct) return direct;
  const text = argsText?.trim();
  if (!text) return null;
  try {
    return commandFromArgsObject(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

/** assistant-ui passes `interrupt` from the AI SDK converter; frontend-tool path may nest payload. */
function approvalIdFromInterrupt(
  interrupt: { type: "human"; payload: unknown } | undefined,
): string | undefined {
  if (!interrupt || interrupt.type !== "human") return undefined;
  const p = interrupt.payload;
  if (p && typeof p === "object" && p !== null) {
    const rec = p as Record<string, unknown>;
    if (typeof rec.id === "string") return rec.id;
    if (
      rec.type === "human" &&
      rec.payload &&
      typeof rec.payload === "object" &&
      rec.payload !== null &&
      "id" in rec.payload &&
      typeof (rec.payload as { id: unknown }).id === "string"
    ) {
      return (rec.payload as { id: string }).id;
    }
  }
  return undefined;
}

export const CliRunTool: ToolCallMessagePartComponent = (
  props: ToolCallMessagePartProps,
) => {
  const { args, argsText, result, status, resume, interrupt, toolCallId } = props;
  const addToolApprovalResponse = useToolApprovalResponse();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savingAlwaysRun, setSavingAlwaysRun] = useState(false);

  const approvalIdFromMessages = useSyncExternalStore(
    subscribeToolApprovalIndex,
    () => getToolApprovalIdForCall(toolCallId),
    () => undefined,
  );

  console.log(props);

  const approvalId =
    approvalIdFromInterrupt(interrupt) ?? approvalIdFromMessages;

  const command = extractCommand(args, argsText);
  const hasCommand = Boolean(command?.trim());

  const approveRun = () => {
    if (approvalId && addToolApprovalResponse) {
      void addToolApprovalResponse({ id: approvalId, approved: true });
      return;
    }
    resume(true);
  };

  const onApprove = () => {
    setSaveErr(null);
    approveRun();
  };

  const onAlwaysRun = async () => {
    setSaveErr(null);
    const cmd = command?.trim().replace(/\s+/g, " ");
    if (!cmd) return;
    setSavingAlwaysRun(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCliAlwaysAllowCommand: cmd }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setSaveErr(j.error ?? `Save failed (${r.status})`);
        setSavingAlwaysRun(false);
        return;
      }
      window.dispatchEvent(new Event("settings-updated"));
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
      setSavingAlwaysRun(false);
      return;
    }
    setSavingAlwaysRun(false);
    approveRun();
  };

  const onReject = () => {
    if (approvalId && addToolApprovalResponse) {
      void addToolApprovalResponse({ id: approvalId, approved: false });
      return;
    }
    resume(false);
  };

  const waitingForApproval = status.type === "requires-action";
  const running = result === undefined && !waitingForApproval;
  const output = formatOutput(result);

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#dadce0] bg-white/95 shadow-sm dark:border-[#3c4043] dark:bg-[#1e1f20]">
      <div className="flex items-center justify-between border-b border-[#e8eaed] px-3 py-2 dark:border-[#34373b]">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1f1f1f] dark:text-[#e8eaed]">
          <TerminalSquare className="size-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
          CLI Run
        </div>
        <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
          {waitingForApproval ? "Waiting for approval" : running ? "Running..." : "Completed"}
        </div>
      </div>

      {command ? (
        <div className="border-b border-[#e8eaed] bg-[#f8f9fb] px-3 py-2.5 dark:border-[#34373b] dark:bg-[#171b20]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#5f6368] dark:text-[#9aa0a6]">
            Command
          </p>
          <pre className="overflow-auto rounded-md bg-[#101317] px-2.5 py-2 font-mono text-xs text-[#d9e2ec]">
            <span className="text-[#7ee787]">$ </span>
            {command}
          </pre>
        </div>
      ) : null}

      <pre className="max-h-72 overflow-auto bg-[#101317] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#d9e2ec] dark:bg-[#0d1117]">
        {output}
      </pre>

      {waitingForApproval ? (
        <div className="flex flex-col gap-2 border-t border-[#e8eaed] px-3 py-2.5 dark:border-[#34373b]">
          {saveErr ? (
            <p className="text-[11px] text-red-600 dark:text-red-400">{saveErr}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={savingAlwaysRun}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4] disabled:opacity-50 dark:border-[#3c4043] dark:bg-[#1f2328] dark:text-[#c9d1d9] dark:hover:bg-[#262c36]"
            >
              <X className="size-3.5" />
              Reject
            </button>
            <button
              type="button"
              disabled={savingAlwaysRun}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1765cc] disabled:opacity-50 dark:bg-[#2f81f7] dark:hover:bg-[#1f6feb]"
            >
              <Check className="size-3.5" />
              Accept
            </button>
            <button
              type="button"
              disabled={!hasCommand || savingAlwaysRun}
              title="Save this command to settings and run; future runs skip approval"
              onClick={() => void onAlwaysRun()}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#1a73e8]/40 bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#174ea6] hover:bg-[#d2e3fc] disabled:pointer-events-none disabled:opacity-45 dark:border-[#8ab4f8]/40 dark:bg-[#1e3a5f]/50 dark:text-[#8ab4f8] dark:hover:bg-[#1e3a5f]/80"
            >
              {savingAlwaysRun ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="size-3.5" />
              )}
              Always run
            </button>
          </div>
          <p className="text-[11px] text-[#70757a] dark:text-[#9aa0a6]">
            Always run saves the CLI program name (e.g. npm from npm run dev) to settings and approves
            once; later runs of that program skip approval.
          </p>
        </div>
      ) : running ? (
        <div className="flex items-center gap-2 border-t border-[#e8eaed] px-3 py-2 text-xs text-[#5f6368] dark:border-[#34373b] dark:text-[#9aa0a6]">
          <Loader2 className="size-3.5 animate-spin" />
          Executing command...
        </div>
      ) : null}
    </div>
  );
};
