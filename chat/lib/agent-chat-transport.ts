"use client";

import type { AssistantRuntime, Tool } from "@assistant-ui/react";
import {
  DefaultChatTransport,
  type ChatAddToolApproveResponseFunction,
  type HttpChatTransportInitOptions,
  type JSONSchema7,
  type UIMessage,
} from "ai";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import { z } from "zod/v4";

const AgentChatTransportContext = createContext<AgentChatTransport<UIMessage> | null>(
  null,
);

/** Wrap the app (with the same `AgentChatTransport` instance passed to `useAgentChatRuntime`). */
export function AgentChatTransportProvider({
  transport,
  children,
}: {
  transport: AgentChatTransport<UIMessage>;
  children: ReactNode;
}) {
  return createElement(
    AgentChatTransportContext.Provider,
    { value: transport },
    children,
  );
}

export function useAgentChatTransport(): AgentChatTransport<UIMessage> | null {
  return useContext(AgentChatTransportContext);
}

const toAISDKTools = (tools: Record<string, Tool>) => {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [
      name,
      {
        ...(t.description ? { description: t.description } : undefined),
        parameters: (t.parameters instanceof z.ZodType
          ? z.toJSONSchema(t.parameters)
          : t.parameters) as JSONSchema7,
      },
    ]),
  );
};

const getEnabledTools = (tools: Record<string, Tool>) => {
  return Object.fromEntries(
    Object.entries(tools).filter(
      ([, t]) => !t.disabled && t.type !== "backend",
    ),
  );
};

/**
 * AssistantChatTransport behavior plus `model` in the JSON body from
 * `thread.getModelContext().config.modelName` (assistant-ui ModelSelector).
 * `setRuntime` must be called (useChatRuntime only does this for AssistantChatTransport).
 */
export class AgentChatTransport<
  UI_MESSAGE extends UIMessage = UIMessage,
> extends DefaultChatTransport<UI_MESSAGE> {
  private runtime: AssistantRuntime | undefined;
  private forcedThreadId: string | null = null;

  constructor(initOptions?: HttpChatTransportInitOptions<UI_MESSAGE>) {
    super({
      ...initOptions,
      prepareSendMessagesRequest: async (options) => {
        const context = this.runtime?.thread.getModelContext();
        const modelName = context?.config?.modelName;
        const threadState = this.runtime?.thread.getState() as unknown as {
          threadId?: string;
        };
        const runtimeThreadId = threadState?.threadId;
        const threadId = this.forcedThreadId ?? runtimeThreadId;

        const optionsEx = {
          ...options,
          body: {
            ...options?.body,
            system: context?.system,
            tools: toAISDKTools(getEnabledTools(context?.tools ?? {})),
            ...(modelName ? { model: modelName } : {}),
            ...(threadId ? { threadId } : {}),
          },
        };
        const preparedRequest =
          await initOptions?.prepareSendMessagesRequest?.(optionsEx);

        return {
          ...preparedRequest,
          body: preparedRequest?.body ?? {
            ...optionsEx.body,
            id: options.id,
            messages: options.messages,
            trigger: options.trigger,
            messageId: options.messageId,
          },
        };
      },
    });
  }

  setRuntime(runtime: AssistantRuntime) {
    this.runtime = runtime;
  }

  /**
   * Stable server-side agent id to send as `threadId` to /api/chat.
   * This avoids SDK fallbacks like "DEFAULT_THREAD_ID" and local "__LOCALID_*" ids.
   */
  setForcedThreadId(threadId: string | null) {
    const t = (threadId ?? "").trim();
    if (!t || t === "DEFAULT_THREAD_ID" || t.startsWith("__LOCALID_")) {
      this.forcedThreadId = null;
      return;
    }
    this.forcedThreadId = t;
  }
}
