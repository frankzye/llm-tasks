"use client";

import {
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { Check, Loader2, TerminalSquare, X } from "lucide-react";
import { useToolApprovalResponse } from "@/lib/tool-approval-response-context";

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

export const CliRunTool: ToolCallMessagePartComponent = (
  props: ToolCallMessagePartProps,
) => {
  const { result, status, resume, interrupt } = props;
  const addToolApprovalResponse = useToolApprovalResponse();

  const approvalId =
    interrupt?.type === "human" &&
      interrupt.payload &&
      typeof interrupt.payload === "object" &&
      "id" in interrupt.payload &&
      typeof interrupt.payload.id === "string"
      ? interrupt.payload.id
      : undefined;

  const onApprove = () => {
    if (approvalId && addToolApprovalResponse) {
      void addToolApprovalResponse({ id: approvalId, approved: true });
      return;
    }
    resume(true);
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

      <pre className="max-h-72 overflow-auto bg-[#101317] px-3 py-2.5 font-mono text-xs leading-relaxed text-[#d9e2ec] dark:bg-[#0d1117]">
        {output}
      </pre>

      {waitingForApproval ? (
        <div className="flex items-center justify-end gap-2 border-t border-[#e8eaed] px-3 py-2.5 dark:border-[#34373b]">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4] dark:border-[#3c4043] dark:bg-[#1f2328] dark:text-[#c9d1d9] dark:hover:bg-[#262c36]"
          >
            <X className="size-3.5" />
            Reject
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1765cc] dark:bg-[#2f81f7] dark:hover:bg-[#1f6feb]"
          >
            <Check className="size-3.5" />
            Accept
          </button>
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
