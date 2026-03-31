"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AgentThreadBootstrap } from "@/components/assistant-ui/agent-thread-bootstrap";
import { Sidebar } from "@/components/assistant-ui/sidebar";
import { Thread } from "@/components/assistant-ui/thread";
import { AgentChatTransport } from "@/lib/agent-chat-transport";
import { useAgentChatRuntime } from "@/lib/use-agent-chat-runtime";

function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const transport = useMemo(() => new AgentChatTransport(), []);
  const runtime = useAgentChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentThreadBootstrap />
      <div className="flex h-[100dvh] flex-col">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#e8eaed] bg-[#f8f9fa] px-4 dark:border-[#3c4043] dark:bg-[#131314]">
          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">
            LLM Tasks Agent
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/settings"
              className="text-xs font-medium text-[#1a73e8] hover:underline dark:text-[#8ab4f8]"
            >
              Settings
            </Link>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
          />
          <main className="min-w-0 flex-1">
            <Thread />
          </main>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

export default function Home() {
  return <ChatShell />;
}
