"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { A2ASendTool } from "@/src/components/assistant-ui/a2a-tool";
import { AgentThreadBootstrap } from "@/src/components/assistant-ui/agent-thread-bootstrap";
import { Sidebar } from "@/src/components/assistant-ui/sidebar";
import { TaskBoard } from "@/src/components/assistant-ui/task-board";
import { Thread } from "@/src/components/assistant-ui/thread";
import { AgentChatTransport } from "@/src/lib/agent-chat-transport";
import { ToolApprovalResponseContext } from "@/src/lib/tool-approval-response-context";
import { useAgentChatRuntime } from "@/src/lib/use-agent-chat-runtime";

function ChatShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const transport = useMemo(() => new AgentChatTransport(), []);
  const { runtime, addToolApprovalResponse } = useAgentChatRuntime({
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ToolApprovalResponseContext.Provider value={addToolApprovalResponse}>
        <A2ASendTool />
        <AgentThreadBootstrap />
        <div className="flex h-[100dvh] flex-col">
          <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#e8eaed] bg-[#f8f9fa] px-4 dark:border-[#3c4043] dark:bg-[#131314]">
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
            <main className="flex min-h-0 min-w-0 flex-1">
              <div className="min-h-0 min-w-0 flex-1">
                <Thread />
              </div>
              <aside className="hidden w-[min(100%,320px)] shrink-0 md:flex md:flex-col">
                <TaskBoard />
              </aside>
            </main>
          </div>
        </div>
      </ToolApprovalResponseContext.Provider>
    </AssistantRuntimeProvider>
  );
}

export default function Home() {
  return <ChatShell />;
}
