"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import {
  unstable_useRemoteThreadListRuntime,
  useRuntimeAdapters,
  useThreadListItem,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import type { ChatInit } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { AgentChatTransport } from "@/lib/agent-chat-transport";
import { createAgentsThreadListAdapter } from "@/lib/agent-thread-list-adapter";

type AISDKRuntimeAdapterArg = NonNullable<Parameters<typeof useAISDKRuntime>[1]>;

type Options<UI_MESSAGE extends UIMessage> = ChatInit<UI_MESSAGE> &
  AISDKRuntimeAdapterArg & {
    transport?: AgentChatTransport<UI_MESSAGE>;
  };

function useChatThreadRuntimeBody<UI_MESSAGE extends UIMessage>(
  options?: Options<UI_MESSAGE>,
) {
  const {
    adapters,
    transport: transportOptions,
    onFinish: userOnFinish,
    ...chatOptions
  } = options ?? {};
  const transport =
    transportOptions ?? new AgentChatTransport<UI_MESSAGE>();

  const item = useThreadListItem();
  const remoteId = item.remoteId;
  const threadId = item.id;
  const storageKey =
    remoteId ??
    (threadId && !threadId.startsWith("__LOCALID_") ? threadId : null);

  const loadSeqRef = useRef(0);
  const storageKeyRef = useRef<string | null>(null);
  storageKeyRef.current = storageKey;
  /** Avoid persisting right after hydration; debounced save uses latest snapshot. */
  const lastPersistedJsonRef = useRef<string>("");
  const messagesRef = useRef<UI_MESSAGE[]>([]);

  const persist = useCallback((messagesToSave: UIMessage[]) => {
    const key = storageKeyRef.current;
    if (!key || key.startsWith("__LOCALID_")) return;
    if (
      messagesToSave.length === 0 &&
      lastPersistedJsonRef.current === ""
    ) {
      return;
    }
    const json = JSON.stringify(messagesToSave);
    if (json === lastPersistedJsonRef.current) return;
    lastPersistedJsonRef.current = json;
    void fetch(`/api/agents/${encodeURIComponent(key)}/messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesToSave }),
    }).catch((e) => {
      console.error("[conversation] save failed", e);
    });
  }, []);

  const onFinishWrapped = useCallback(
    (
      opts: Parameters<NonNullable<ChatInit<UI_MESSAGE>["onFinish"]>>[0],
    ) => {
      userOnFinish?.(opts);
    },
    [userOnFinish],
  );

  const contextAdapters = useRuntimeAdapters();

  const chat = useChat({
    ...chatOptions,
    onFinish: onFinishWrapped,
    transport,
  });

  const { messages, setMessages } = chat;
  messagesRef.current = messages as UI_MESSAGE[];

  useEffect(() => {
    lastPersistedJsonRef.current = "";
  }, [storageKey]);

  /** Save whenever messages change (streaming deltas, tools, edits), not only on onFinish. */
  useEffect(() => {
    if (!storageKey || storageKey.startsWith("__LOCALID_")) return;
    const t = window.setTimeout(() => {
      const latest = messagesRef.current;
      persist(latest as UIMessage[]);
    }, 450);
    return () => window.clearTimeout(t);
  }, [messages, storageKey, persist]);

  const runtime = useAISDKRuntime(chat as never, {
    adapters: {
      ...contextAdapters,
      ...adapters,
    },
  });

  useEffect(() => {
    transport.setRuntime(runtime);
  }, [transport, runtime]);

  useEffect(() => {
    if (!storageKey || storageKey.startsWith("__LOCALID_")) return;
    const seq = ++loadSeqRef.current;
    let cancelled = false;
    void fetch(`/api/agents/${encodeURIComponent(storageKey)}/messages`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data: { messages?: UIMessage[] }) => {
        if (cancelled || seq !== loadSeqRef.current) return;
        const loaded = data.messages ?? [];
        if (loaded.length === 0) return;
        lastPersistedJsonRef.current = JSON.stringify(loaded);
        setMessages((prev) =>
          prev.length === 0 ? (loaded as UI_MESSAGE[]) : prev,
        );
      })
      .catch((e) => {
        console.error("[conversation] load failed", e);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey, setMessages]);

  return runtime;
}

/**
 * Same as `@assistant-ui/react-ai-sdk` `useChatRuntime`, but thread list is backed by
 * `GET/POST /api/agents` so agents load from disk and new threads create new agents.
 * Conversations persist under `.data/agents/<id>/conversation.json`.
 */
export function useAgentChatRuntime<UI_MESSAGE extends UIMessage = UIMessage>(
  options?: Options<UI_MESSAGE>,
) {
  const adapter = useMemo(() => createAgentsThreadListAdapter(), []);

  return unstable_useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      return useChatThreadRuntimeBody(options);
    },
    adapter,
  });
}
