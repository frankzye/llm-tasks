import type { UIMessage } from "@ai-sdk/react";
import { isToolUIPart } from "ai";

/**
 * Maps toolCallId → approval id from the live AI SDK `messages` array (see useChat).
 * Used when @assistant-ui/react-ai-sdk omits `interrupt` on tool-call parts (e.g. duplicate
 * toolCallId handling in the message converter).
 */
const map = new Map<string, string>();
const listeners = new Set<() => void>();

export function subscribeToolApprovalIndex(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getToolApprovalIdForCall(toolCallId: string | undefined): string | undefined {
  if (!toolCallId) return undefined;
  return map.get(toolCallId);
}

function notify() {
  for (const cb of listeners) cb();
}

/** Call whenever useChat `messages` changes (e.g. from useAgentChatRuntime). */
export function syncToolApprovalIndexFromMessages(messages: UIMessage[]): void {
  map.clear();
  for (const m of messages) {
    if (m.role !== "assistant" || !m.parts) continue;
    for (const p of m.parts) {
      if (!isToolUIPart(p)) continue;
      if (
        p.state === "approval-requested" &&
        "approval" in p &&
        p.approval &&
        typeof p.approval === "object" &&
        "id" in p.approval &&
        typeof (p.approval as { id: unknown }).id === "string"
      ) {
        map.set(p.toolCallId, (p.approval as { id: string }).id);
      }
    }
  }
  notify();
}
