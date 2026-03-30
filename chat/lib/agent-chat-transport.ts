import type { AssistantRuntime, Tool } from "@assistant-ui/react";
import {
  DefaultChatTransport,
  type HttpChatTransportInitOptions,
  type JSONSchema7,
  type UIMessage,
} from "ai";
import { z } from "zod/v4";

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
export class AgentChatTransport<UI_MESSAGE extends UIMessage> extends DefaultChatTransport<UI_MESSAGE> {
  private runtime: AssistantRuntime | undefined;

  constructor(initOptions?: HttpChatTransportInitOptions<UI_MESSAGE>) {
    super({
      ...initOptions,
      prepareSendMessagesRequest: async (options) => {
        const context = this.runtime?.thread.getModelContext();
        const modelName = context?.config?.modelName;
        const threadId = this.runtime?.thread.getState().threadId;

        const optionsEx = {
          ...options,
          body: {
            system: context?.system,
            tools: toAISDKTools(getEnabledTools(context?.tools ?? {})),
            ...(modelName ? { model: modelName } : {}),
            ...(threadId ? { threadId } : {}),
            ...options?.body,
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
}
