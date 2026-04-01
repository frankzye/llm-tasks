"use client";

import type { unstable_RemoteThreadListAdapter } from "@assistant-ui/react";

type AgentRow = { id: string; name: string };

export function createAgentsThreadListAdapter(): unstable_RemoteThreadListAdapter {
  return {
    async list() {
      const r = await fetch("/api/agents");
      if (!r.ok) throw new Error(`agents list failed: ${r.status}`);
      const j = (await r.json()) as { agents: AgentRow[] };
      return {
        threads: j.agents.map((a) => ({
          status: "regular" as const,
          remoteId: a.id,
          title: a.name,
          externalId: a.id,
        })),
      };
    },
    async initialize(_threadId) {
      const existing = await fetch("/api/agents");
      if (!existing.ok) throw new Error(`agents list failed: ${existing.status}`);
      const listed = (await existing.json()) as { agents: AgentRow[] };
      const first = listed.agents[0];
      if (first?.id) {
        return { remoteId: first.id, externalId: first.id };
      }

      const r = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Agent" }),
      });
      if (!r.ok) throw new Error(`create agent failed: ${r.status}`);
      const a = (await r.json()) as AgentRow;
      return { remoteId: a.id, externalId: a.id };
    },
    async rename(remoteId, newTitle) {
      await fetch(`/api/agents/${encodeURIComponent(remoteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTitle }),
      });
    },
    async archive() {
      /* no-op: we don't persist archived state on disk yet */
    },
    async unarchive() {
      /* no-op */
    },
    async delete(remoteId) {
      await fetch(`/api/agents/${encodeURIComponent(remoteId)}`, {
        method: "DELETE",
      });
    },
    generateTitle: async () => new ReadableStream(),
    async fetch(threadId) {
      const r = await fetch(`/api/agents/${encodeURIComponent(threadId)}`);
      if (!r.ok) throw new Error(`agent fetch failed: ${r.status}`);
      const a = (await r.json()) as AgentRow;
      return {
        status: "regular" as const,
        remoteId: a.id,
        externalId: a.id,
        title: a.name,
      };
    },
  };
}
