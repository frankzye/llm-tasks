"use client";

import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useThreadList,
  useThreadListItem,
  useThreadListItemRuntime,
} from "@assistant-ui/react";
import { Bot, Eraser, MoreVertical, PanelLeftClose, PanelLeftOpen, Settings, Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { type FC, useEffect, useRef, useState } from "react";

import { AgentSettingsModal } from "@/src/components/assistant-ui/agent-settings-panel";
import {
  createAgentOnServer,
  reloadRemoteThreadList,
} from "@/src/lib/remote-thread-list-helpers";

const newAgentDraftActiveClasses =
  "border-[#4285f4]/55 bg-[#4285f4]/[0.1] text-[#1a73e8] dark:border-[#8ab4f8]/50 dark:bg-[#8ab4f8]/[0.12] dark:text-[#8ab4f8]";

/** Explicit handler: `ThreadListPrimitive.New` can end up disabled or no-op in some runtimes. */
const NewAgentButton: FC<{ className?: string }> = ({ className }) => {
  const aui = useAui();
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDraftMain = useThreadList(
    (s) => s.newThreadId !== undefined && s.newThreadId === s.mainThreadId,
  );
  const isLoading = useThreadList((s) => s.isLoading);
  /** Thread list state differs SSR vs client — never put `data-*` from runtime on SSR HTML. */
  const draftActive = mounted && !!isDraftMain;
  const busy = isLoading || creating;
  return (
    <button
      type="button"
      suppressHydrationWarning
      disabled={busy}
      className={`${className}${draftActive ? ` ${newAgentDraftActiveClasses}` : ""} disabled:pointer-events-none disabled:opacity-50`}
      onClick={() => {
        void (async () => {
          setCreating(true);
          try {
            const agent = await createAgentOnServer();
            const runtime = aui.threads().__internal_getAssistantRuntime?.();
            if (!runtime) return;
            await reloadRemoteThreadList(runtime);
            await aui.threads().switchToThread(agent.id);
          } catch (err) {
            console.error("[new agent]", err);
          } finally {
            setCreating(false);
          }
        })();
      }}
    >
      + New agent
    </button>
  );
};

const menuItemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#3c4043] hover:bg-black/[0.06] dark:text-[#e3e3e3] dark:hover:bg-white/10";

const alertOverlayClass =
  "fixed inset-0 z-[200] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out dark:bg-black/55";

const alertContentClass =
  "fixed left-1/2 top-1/2 z-[201] w-[min(90vw,22rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[#dadce0] bg-white p-5 shadow-xl focus:outline-none dark:border-[#3c4043] dark:bg-[#1e1f20]";

const alertBtnCancelClass =
  "inline-flex items-center justify-center rounded-lg border border-[#dadce0] bg-white px-3 py-1.5 text-sm font-medium text-[#3c4043] transition-colors hover:bg-[#f1f3f4] dark:border-[#3c4043] dark:bg-[#2d2f31] dark:text-[#e3e3e3] dark:hover:bg-[#3c4043]";

const alertBtnClearClass =
  "inline-flex items-center justify-center rounded-lg bg-[#1a73e8] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:text-[#0a0d12] dark:hover:bg-[#a8c7fa]";

const alertBtnDeleteClass =
  "inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600";

/** Icon-only control; row chrome (border/hover/active) lives on `ThreadListItemPrimitive.Root`. */
const agentRowKebabBtn =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-[#5f6368] transition-colors hover:text-[#1f1f1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[#f8f9fa] dark:text-[#bdc1c6] dark:hover:text-[#e8eaed] dark:focus-visible:ring-[#8ab4f8]/40 dark:focus-visible:ring-offset-[#0a0d12] group-data-[active=true]:text-[#174ea6] dark:group-data-[active=true]:text-[#8ab4f8]";

/** ⋮ menu: settings + delete. Only for persisted agents (not `__LOCALID_*` drafts). */
const AgentRowMenu: FC<{
  remoteId: string;
  isMain: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}> = ({ remoteId, isMain, menuOpen, onMenuOpenChange }) => {
  const aui = useAui();
  const itemRuntime = useThreadListItemRuntime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"clear" | "delete" | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) onMenuOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, onMenuOpenChange]);

  if (!itemRuntime) return null;

  return (
    <>
      <div
        className="relative flex shrink-0 items-center self-center"
        ref={wrapRef}
      >
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Agent options"
          title="Agent options"
          className={agentRowKebabBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
        >
          <MoreVertical className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-[100] min-w-[11rem] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg dark:border-[#3c4043] dark:bg-[#1e1f20]"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={(e) => {
                e.stopPropagation();
                onMenuOpenChange(false);
                setSettingsOpen(true);
              }}
            >
              <Settings className="size-4 shrink-0 opacity-70" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={(e) => {
                e.stopPropagation();
                onMenuOpenChange(false);
                setConfirmAction("clear");
              }}
            >
              <Eraser className="size-4 shrink-0 opacity-70" />
              Clear messages
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} text-red-600 hover:bg-red-500/10 dark:text-red-400`}
              onClick={(e) => {
                e.stopPropagation();
                onMenuOpenChange(false);
                setConfirmAction("delete");
              }}
            >
              <Trash2 className="size-4 shrink-0 opacity-70" />
              Delete
            </button>
          </div>
        ) : null}
      </div>
      {settingsOpen ? (
        <AgentSettingsModal
          key={remoteId}
          agentId={remoteId}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <AlertDialog.Root
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={alertOverlayClass} />
          <AlertDialog.Content className={alertContentClass}>
            <AlertDialog.Title className="text-base font-semibold text-[#1f1f1f] dark:text-[#e8eaed]">
              {confirmAction === "clear"
                ? "Clear all messages?"
                : "Delete this agent?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-[#5f6368] dark:text-[#9aa0a6]">
              {confirmAction === "clear"
                ? "This removes all messages for this agent from the server."
                : "This agent’s folder and conversation will be removed."}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel className={alertBtnCancelClass}>
                Cancel
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={
                  confirmAction === "delete"
                    ? alertBtnDeleteClass
                    : alertBtnClearClass
                }
                onClick={() => {
                  if (confirmAction === "clear") {
                    void fetch(
                      `/api/agents/${encodeURIComponent(remoteId)}/messages`,
                      {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messages: [] }),
                      },
                    )
                      .then((r) => {
                        if (!r.ok) {
                          throw new Error(`clear messages failed: ${r.status}`);
                        }
                        if (isMain) {
                          aui.thread().reset([]);
                        }
                      })
                      .catch((err) => {
                        console.error("[clear messages]", err);
                      });
                  } else if (confirmAction === "delete") {
                    void itemRuntime.delete().catch((err) => {
                      console.error("[delete agent]", err);
                    });
                  }
                }}
              >
                {confirmAction === "clear" ? "Clear" : "Delete"}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

/**
 * Trigger covers the label + avatar only; ⋮ is outside so it does not call `switchTo()`.
 */
const agentRowRootClass =
  "group relative flex items-center gap-0 text-sm rounded-lg border border-transparent px-2 py-2 transition-colors duration-150 hover:border-[#dadce0] hover:bg-black/[0.04] dark:hover:border-[#3c4043] dark:hover:bg-white/[0.06] group-data-[active=true]:border-[#1a73e8]/20 group-data-[active=true]:bg-[#e8f0fe] group-data-[active=true]:shadow-sm dark:group-data-[active=true]:border-[#8ab4f8]/25 dark:group-data-[active=true]:bg-[#1e3a5f]/45 data-[menu-open=true]:border-[#4285f4]/45 data-[menu-open=true]:ring-1 data-[menu-open=true]:ring-[#4285f4]/20 dark:data-[menu-open=true]:border-[#8ab4f8]/45 dark:data-[menu-open=true]:ring-[#8ab4f8]/25";

const ThreadListItem: FC = () => {
  const remoteId = useThreadListItem((s) => s.remoteId);
  const status = useThreadListItem((s) => s.status);
  const isMain = useThreadListItem((s) => s.isMain);
  const showMenu = Boolean(remoteId && status === "regular");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMain) setMenuOpen(false);
  }, [isMain]);

  return (
    <ThreadListItemPrimitive.Root
      className={agentRowRootClass}
      data-menu-open={menuOpen ? "true" : undefined}
    >
      <ThreadListItemPrimitive.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9fa] focus-visible:ring-offset-transparent dark:focus-visible:ring-[#8ab4f8]/40 dark:focus-visible:ring-offset-[#0a0d12]">
        <span
          className="pointer-events-none flex size-8 shrink-0 items-center justify-center rounded-md bg-[#eceff1] text-[#5f6368] transition-colors group-data-[active]:bg-white group-data-[active]:text-[#1a73e8] dark:bg-[#3c4043]/90 dark:text-[#bdc1c6] dark:group-data-[active]:bg-[#0d121b] dark:group-data-[active]:text-[#8ab4f8]"
          aria-hidden
        >
          <Bot className="size-4" strokeWidth={2} />
        </span>
        <span className="pointer-events-none min-w-0 flex-1 truncate text-[#3c4043] transition-colors group-data-[active]:font-semibold group-data-[active]:text-[#174ea6] dark:text-[#bdc1c6] dark:group-data-[active]:text-[#e8eaed]">
          <ThreadListItemPrimitive.Title />
        </span>
      </ThreadListItemPrimitive.Trigger>
      {showMenu && remoteId ? (
        <AgentRowMenu
          remoteId={remoteId}
          isMain={isMain}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
        />
      ) : null}
    </ThreadListItemPrimitive.Root>
  );
};

/** Stable reference so `ThreadListPrimitive.Items` memo does not recreate every row each render. */
const THREAD_LIST_COMPONENTS = { ThreadListItem };

const iconBtn =
  "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#dadce0] bg-white text-[#444746] shadow-sm transition-all hover:border-[#4285f4]/40 hover:bg-[#f1f3f4] hover:text-[#1f1f1f] active:scale-[0.97] dark:border-[#3c4043] dark:bg-[#1e1f20] dark:text-[#c4c7c5] dark:hover:border-[#8ab4f8]/35 dark:hover:bg-[#2d2f31] dark:hover:text-[#e3e3e3]";

export const Sidebar: FC<{ open: boolean; onToggle: () => void }> = ({
  open,
  onToggle,
}) => {
  return (
    <aside
      data-state={open ? "open" : "collapsed"}
      className={`flex h-full shrink-0 flex-col border-r border-[#e8eaed] bg-[#f8f9fa] transition-[width,min-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-[#3c4043] dark:bg-[#0a0d12] ${
        open ? "w-72 min-w-[min(18rem,85vw)]" : "w-[52px] min-w-[52px]"
      }`}
    >
      {!open ? (
        <div className="flex h-full flex-col items-center gap-2 border-r border-transparent pt-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand agents sidebar"
            title="Expand sidebar"
            className={iconBtn}
          >
            <PanelLeftOpen className="size-5" strokeWidth={2} />
          </button>
          <div
            className="mt-1 flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4285f4]/20 to-[#9b72cb]/15 dark:from-[#8ab4f8]/15 dark:to-[#c58af9]/10"
            aria-hidden
          >
            <Bot className="size-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[#e8eaed] px-3 dark:border-[#3c4043]">
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.08em] text-[#70757a] dark:text-[#9aa0a6]">
              Agents
            </span>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className={iconBtn}
            >
              <PanelLeftClose className="size-5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2.5">
            <NewAgentButton className="mb-3 w-full rounded-xl border border-dashed border-[#dadce0] bg-white/60 py-2.5 text-center text-sm font-medium text-[#5f6368] shadow-sm transition-all hover:border-[#4285f4]/50 hover:bg-[#4285f4]/[0.06] hover:text-[#1a73e8] dark:border-[#3c4043] dark:bg-[#131820]/80 dark:text-[#9aa0a6] dark:hover:border-[#8ab4f8]/45 dark:hover:bg-[#8ab4f8]/[0.08] dark:hover:text-[#8ab4f8]" />
            <div className="flex flex-col gap-1">
              <ThreadListPrimitive.Items components={THREAD_LIST_COMPONENTS} />
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
