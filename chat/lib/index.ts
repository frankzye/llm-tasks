/**
 * Public API for consumers who install this package and set `transpilePackages`
 * in their Next.js config so TypeScript sources compile in node_modules.
 */

export {
  AgentChatTransport,
  AgentChatTransportProvider,
  useAgentChatTransport,
} from "./agent-chat-transport";
export { useAgentChatRuntime } from "./use-agent-chat-runtime";
export { createAgentsThreadListAdapter } from "./agent-thread-list-adapter";
export { resolveMainAgentRemoteId } from "./main-agent-id";

export type {
  GlobalSettings,
  ModelProviderConfig,
  ProviderKind,
} from "./global-settings";
export * from "./chat-models";
