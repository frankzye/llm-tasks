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
    async initialize() {
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
  };
}
