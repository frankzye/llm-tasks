# llm-tasks

Personal workspace for LLM-related experiments: a **Next.js chat app** with agents, skills, and optional tooling, plus other subprojects.

## License

This project is licensed under the [MIT License](LICENSE).

---

## Chat app (`chat/`)

A local-first assistant UI built with **Next.js**, **assistant-ui**, and the **Vercel AI SDK**. Agents are stored under `.data/agents/<id>/` (config, conversation, skills). Global settings live in `.data/global-settings.json`.

### Example

![Chat app screenshot](docs/image.png)

### Requirements

- Node.js 20+ (recommended)
- npm

### Run locally

```bash
cd chat
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal).

### Useful paths

| Path | Purpose |
|------|--------|
| `chat/system_prompt.md` | Base system prompt merged for all chats |
| `chat/.data/global-settings.json` | Model providers, default model, CLI allowlist, etc. |
| `chat/.data/agents/<uuid>/` | Per-agent `config.json`, `conversation.json`, `skills/` |
| `chat/app/api/chat/route.ts` | Chat completion + tools (skills, Mem0, CLI, A2A) |
| `chat/app/settings/page.tsx` | Settings UI (models, CLI always-run, skills) |

### Environment

Create `chat/.env.local` as needed for your providers (for example OpenAI / Ollama / DeepSeek API keys and base URLs). Exact variables depend on how you configure providers in **Settings → General**.

Optional Mem0-related variables are used when long-term memory is enabled (see code in `chat/lib/agent/mem0-service.ts`).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Jest (if configured) |

### Use as an npm dependency

The published package exposes TypeScript entry points via `package.json` **`exports`** (see `chat/package.json`). Other teams can install it and import the public API:

```bash
npm install @frankzye/llm-tasks
```

In **your** Next.js app, add the package to `transpilePackages` so `node_modules` sources compile:

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: ["@frankzye/llm-tasks"],
};
export default nextConfig;
```

```ts
// Example
import {
  useAgentChatRuntime,
  AgentChatTransport,
  createAgentsThreadListAdapter,
} from "@frankzye/llm-tasks";
```

Subpaths such as `@frankzye/llm-tasks/lib/agent-chat-transport` are also exported for advanced use.

### Publish to npm (CI)

GitHub Actions workflow [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml) installs, tests, and builds from `chat/`, then runs `npm publish`.

1. Add an [npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) as repository secret **`NPM_TOKEN`**.
2. Bump `version` in `chat/package.json`.
3. Push a tag matching `chat-v*` (for example `chat-v0.2.0`), or run the workflow manually via **Actions → Publish chat to npm → Run workflow**.

From the repo root you can tag and push using the version in `chat/package.json`:

```bash
./scripts/publish-chat-tag.sh --dry-run   # preview tag name
./scripts/publish-chat-tag.sh             # git tag + git push origin chat-v…
```

Update `repository.url` in `chat/package.json` to your real GitHub repo.

---

## Contributing

This is a personal repo; fork or copy under the terms of the MIT license if you find it useful.
