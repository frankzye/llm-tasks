"use client";

/**
 * Layout inspired by assistant-ui Gemini docs example.
 * @see https://github.com/assistant-ui/assistant-ui/blob/main/apps/docs/components/examples/gemini.tsx
 */

import {
  ActionBarPrimitive,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  AuiIf,
} from "@assistant-ui/react";
import {
  Copy,
  ChevronRight,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  PenLine,
  Plus,
  SendHorizontal,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  RotateCw,
  MoreVertical,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FC } from "react";

import {
  GeminiComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { DefaultToolCard } from "@/components/assistant-ui/default-tool";
import {
  AssistantMessageMarkdown,
  UserMessageMarkdown,
} from "@/components/assistant-ui/chat-markdown";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { resolveMainAgentRemoteId } from "@/lib/main-agent-id";
import {
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { ReasoningGroup, Reasoning } from "@/components/assistant-ui/reasoning";


type SettingsApi = {
  modelProviders?: Array<{
    id: string;
    kind: "openai" | "ollama" | "deepseek";
    models: string[];
  }>;
  defaultChatProvider?: string;
  defaultChatModel?: string;
};
type AgentApi = { modelId?: string; modelProviderId?: string };

type ModelSelectionOption = { id: string; name: string; providerId: string; modelId: string };

function useRuntimeModelConfig() {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadIdsKey = useAuiState((s) => s.threads.threadIds.join("|"));
  const [models, setModels] = useState<Array<ModelSelectionOption>>([
    {
      id: "openai::qwen3.5:0.8b",
      name: "openai / qwen3.5:0.8b",
      providerId: "openai",
      modelId: "qwen3.5:0.8b",
    },
  ]);
  const [selectedModel, setSelectedModel] = useState("openai::qwen3.5:0.8b");
  const [agentId, setAgentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const runtime = aui.threads().__internal_getAssistantRuntime?.();
    if (!runtime) return;
    const id = resolveMainAgentRemoteId(runtime);
    setAgentId(id);
    const settingsRes = await fetch("/api/settings").then((r) =>
      r.ok
        ? (r.json() as Promise<SettingsApi>)
        : {
            modelProviders: [
              { id: "openai", kind: "openai" as const, models: ["qwen3.5:0.8b"] },
            ],
            defaultChatProvider: "openai",
            defaultChatModel: "qwen3.5:0.8b",
          },
    );
    const providers =
      settingsRes.modelProviders?.filter((p) => p.id && p.models?.length) ?? [
        { id: "openai", kind: "openai" as const, models: ["qwen3.5:0.8b"] },
      ];
    const nextModels = providers.flatMap((p) =>
      p.models
        .filter(Boolean)
        .map((m) => ({
          id: `${p.id}::${m}`,
          name: `${p.kind} / ${m}`,
          providerId: p.id,
          modelId: m,
        })),
    );
    setModels(nextModels);

    const defaultProviderId = settingsRes.defaultChatProvider ?? providers[0]?.id ?? "openai";
    const defaultModel =
      settingsRes.defaultChatModel ?? providers.find((p) => p.id === defaultProviderId)?.models[0] ?? providers[0]?.models[0] ?? "qwen3.5:0.8b";
    let chosen = `${defaultProviderId}::${defaultModel}`;
    if (id) {
      let agentRes: AgentApi = {};
      try {
        const r = await fetch(`/api/agents/${encodeURIComponent(id)}`);
        if (r.ok) agentRes = (await r.json()) as AgentApi;
      } catch {
        /* ignore */
      }
      if (agentRes.modelId && agentRes.modelProviderId) {
        const candidate = `${agentRes.modelProviderId}::${agentRes.modelId}`;
        if (nextModels.some((m) => m.id === candidate)) {
          chosen = candidate;
        }
      }
    }
    setSelectedModel(chosen);
  }, [aui]);

  useEffect(() => {
    void load();
  }, [load, mainThreadId, threadIdsKey]);

  useEffect(() => {
    const onSettingsUpdated = () => {
      void load();
    };
    const onFocus = () => {
      void load();
    };
    window.addEventListener("settings-updated", onSettingsUpdated);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("settings-updated", onSettingsUpdated);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const onModelChange = useCallback(
    (next: string) => {
      setSelectedModel(next);
      if (!agentId) return;
      const [providerId, ...modelParts] = next.split("::");
      const modelId = modelParts.join("::");
      if (!providerId || !modelId) return;
      void fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelProviderId: providerId, modelId }),
      }).catch(() => {});
    },
    [agentId],
  );

  const selectedModelEntry = models.find((m) => m.id === selectedModel);
  return {
    models,
    selectedModel,
    selectedModelContextValue: selectedModelEntry?.modelId ?? "qwen3.5:0.8b",
    onModelChange,
  };
}

const actionBtnClass =
  "flex size-8 items-center justify-center rounded-full text-[#444746] transition-colors hover:bg-[#444746]/8 dark:text-[#c4c7c5] dark:hover:bg-[#c4c7c5]/8";

const chatContentWidth =
  "w-full max-w-[min(1100px,calc(100vw-7rem))] xl:max-w-[min(1400px,calc(100vw-8rem))]";


const ChatMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);

  if (role === "user") {
    return (
      <MessagePrimitive.Root className={`group/message relative mx-auto mb-4 flex ${chatContentWidth} flex-col pb-0.5`}>
        <div className="flex items-center justify-end gap-1">
          <ActionBarPrimitive.Root className="flex items-center gap-0.5 pt-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            <ActionBarPrimitive.Copy className={actionBtnClass}>
              <Copy width={16} height={16} />
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Edit className={actionBtnClass}>
              <PenLine width={16} height={16} />
            </ActionBarPrimitive.Edit>
          </ActionBarPrimitive.Root>
          <div className="max-w-[85%] rounded-3xl rounded-tr bg-[#e9eef6] px-4 py-3 text-[#1f1f1f] dark:bg-[#282a2c] dark:text-[#e3e3e3]">
            <UserMessageAttachments />
            <div className="flex flex-col gap-3 wrap-break-word text-sm leading-relaxed">
              <MessagePrimitive.Parts
                components={{
                  Text: UserMessageMarkdown,
                }}
              />
            </div>
          </div>
        </div>
      </MessagePrimitive.Root>
    );
  }

  if (role === "assistant") {
    return (
      <MessagePrimitive.Root className={`group/message relative mx-auto mb-4 flex ${chatContentWidth} flex-col pb-0.5`}>
        <div className="flex items-start gap-3">
          <div
            className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285f4] to-[#9b72cb] text-[10px] text-white"
            aria-hidden
          >
            AI
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 wrap-break-word text-sm leading-relaxed text-[#1f1f1f] dark:text-[#e3e3e3]">
              <MessagePrimitive.Parts
                components={{
                  ReasoningGroup: ReasoningGroup,
                  Reasoning: Reasoning,
                  Text: AssistantMessageMarkdown,
                  tools: {
                    Fallback: DefaultToolCard,
                  }
                }}
              />
            </div>
            <ActionBarPrimitive.Root className="mt-2 -ml-2 flex items-center gap-0.5 opacity-0 transition-opacity duration-300 group-focus-within/message:opacity-100 group-hover/message:opacity-100">
              <ActionBarPrimitive.Reload className={actionBtnClass}>
                <RotateCw width={14} height={14} />
              </ActionBarPrimitive.Reload>
              <ActionBarPrimitive.Copy className={actionBtnClass}>
                <Copy width={14} height={14} />
              </ActionBarPrimitive.Copy>
              <button
                type="button"
                className={actionBtnClass}
                aria-label="More"
              >
                <MoreVertical width={14} height={14} />
              </button>
            </ActionBarPrimitive.Root>
          </div>
        </div>
      </MessagePrimitive.Root>
    );
  }

  return null;
};

const SuggestionChip: FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  prompt: string;
}> = ({ icon, children, prompt }) => (
  <ThreadPrimitive.Suggestion
    prompt={prompt}
    autoSend
    type="button"
    className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm text-[#444746] shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#f1f3f4] dark:bg-[#282a2c] dark:text-[#c4c7c5] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] dark:hover:bg-[#333537]"
  >
    {icon}
    {children}
  </ThreadPrimitive.Suggestion>
);

const GeminiComposer: FC = () => {
  const isEmpty = useAuiState((s) => s.composer.isEmpty);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const hasAttachments = useAuiState((s) => s.composer.attachments.length > 0);
  const { models, selectedModel, selectedModelContextValue, onModelChange } =
    useRuntimeModelConfig();

  return (
    <ComposerPrimitive.Root
      data-empty={isEmpty}
      data-running={isRunning}
      className={`group/composer mx-auto flex ${chatContentWidth} flex-col rounded-[2rem] bg-white p-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.16)] dark:bg-[#1e1f20] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]`}
    >
      {hasAttachments ? (
        <div className="overflow-hidden rounded-t-3xl">
          <div className="overflow-x-auto p-3.5">
            <div className="flex flex-row gap-3">
              <GeminiComposerAttachments />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <div className="max-h-96 w-full overflow-y-auto wrap-break-word">
            <ComposerPrimitive.Input
              placeholder="Ask anything"
              className="block min-h-6 w-full resize-none bg-transparent px-3 py-2 text-[#1f1f1f] outline-none placeholder:text-[#70757a] dark:text-[#e3e3e3] dark:placeholder:text-[#9aa0a6]"
            />
          </div>
        </div>

        <div className="flex w-full items-center text-[#444746] dark:text-[#c4c7c5]">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ComposerPrimitive.AddAttachment className="flex size-10 shrink-0 items-center justify-center rounded-full transition-all hover:bg-[#444746]/8 active:scale-[0.98] dark:hover:bg-[#c4c7c5]/8">
              <Plus width={20} height={20} />
            </ComposerPrimitive.AddAttachment>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-0 max-w-[11rem] shrink">
              <ModelSelector
                models={models}
                value={selectedModel}
                contextValue={selectedModelContextValue}
                onValueChange={onModelChange}
                variant="outline"
                className="w-full border-[#dadce0] text-xs dark:border-[#3c4043]"
              />
            </div>
            <div className="relative size-10 shrink-0">
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center rounded-full transition-all duration-300 ease-out hover:bg-[#444746]/8 group-data-[empty=false]/composer:scale-0 group-data-[running=true]/composer:scale-0 group-data-[empty=false]/composer:opacity-0 group-data-[running=true]/composer:opacity-0 dark:hover:bg-[#c4c7c5]/8"
                aria-label="Voice mode"
              >
                <Mic width={20} height={20} />
              </button>
              <ComposerPrimitive.Send className="absolute inset-0 flex items-center justify-center rounded-full bg-[#d3e3fd] text-[#1f1f1f] transition-all duration-300 ease-out hover:bg-[#c2d7fb] group-data-[empty=true]/composer:scale-0 group-data-[running=true]/composer:scale-0 group-data-[empty=true]/composer:opacity-0 group-data-[running=true]/composer:opacity-0 dark:bg-[#1f3760] dark:text-[#e3e3e3] dark:hover:bg-[#2a4a7a]">
                <SendHorizontal width={20} height={20} />
              </ComposerPrimitive.Send>
              <ComposerPrimitive.Cancel className="absolute inset-0 flex items-center justify-center rounded-full bg-[#d3e3fd] text-[#1f1f1f] transition-all duration-300 ease-out hover:bg-[#c2d7fb] group-data-[running=false]/composer:scale-0 group-data-[running=false]/composer:opacity-0 dark:bg-[#1f3760] dark:text-[#e3e3e3] dark:hover:bg-[#2a4a7a]">
                <Square width={14} height={14} fill="currentColor" />
              </ComposerPrimitive.Cancel>
            </div>
          </div>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
};

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col items-stretch bg-[#f8f9fa] dark:bg-[#131314]">
      <ThreadPrimitive.Empty>
        <div className="flex h-full min-h-0 flex-col justify-center px-4">
          <div className={`mx-auto ${chatContentWidth}`}>
            <div className="mb-1 flex items-center gap-3">
              <Sparkles
                className="size-5 text-[#1a73e8] dark:text-[#8ab4f8]"
                aria-hidden
              />
              <p className="text-xl text-black dark:text-white">Hello there</p>
            </div>
            <p className="mb-6 text-4xl text-black dark:text-white">
              Where would you like to start?
            </p>
          </div>
          <GeminiComposer />
          <div className={`mx-auto mt-4 flex ${chatContentWidth} flex-wrap justify-center gap-2`}>
            <SuggestionChip
              icon={<ImageIcon width={16} height={16} />}
              prompt="Describe this image idea: a calm mountain lake at sunrise."
            >
              Create image
            </SuggestionChip>
            <SuggestionChip
              icon={<Lightbulb width={16} height={16} />}
              prompt="Explain how attention works in transformers."
            >
              Help me learn
            </SuggestionChip>
            <SuggestionChip
              icon={<PenLine width={16} height={16} />}
              prompt="Draft a short professional email follow-up after an interview."
            >
              Write anything
            </SuggestionChip>
            <SuggestionChip
              icon={<Sparkles width={16} height={16} />}
              prompt="Give me 3 quick wins to improve focus today."
            >
              Boost my day
            </SuggestionChip>
          </div>
        </div>
      </ThreadPrimitive.Empty>

      <ThreadPrimitive.If empty={false}>
        <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col overflow-y-scroll px-4 pt-8">
          <ThreadPrimitive.Messages>
            {({ message }) => {
              return <ChatMessage />;
            }}
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>
        <div className="space-y-2 px-4 pb-4">
          <GeminiComposer />
          <p className="my-3 text-center text-xs text-[#70757a] dark:text-[#9aa0a6]">
            Model responses may be inaccurate. Double-check important
            information.
          </p>
        </div>
      </ThreadPrimitive.If>
    </ThreadPrimitive.Root>
  );
};
