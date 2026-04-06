# llm-agent

Personal workspace for LLM-related experiments: a **Next.js chat app** with **assistant-ui**, the **Vercel AI SDK**, per-agent storage, skills, optional Mem0, CLI tools, and A2A between agents. The app lives at the **repository root** under `src/`.

The **npm** tarball is built separately (standalone bundle + `bin` only); the repo root `package.json` is **`private: true`** so you do not accidentally publish the full dev tree.

## License

This project is licensed under the [MIT License](LICENSE).

---

## App overview

- **Agents** — Each chat thread maps to `.data/agents/<id>/` with `config.json`, `conversation.json`, optional `skills/`, Mem0 data, and a per-agent **`task-board.json`** (todo list updated via chat tools `read_task_board` / `update_task_board` in `/api/chat`).
- **Skills** — Global catalog under the data root (`skills/`, `skills.json`), plus per-agent skills; configurable in **Settings** and agent settings.
- **Chat API** — `POST /api/chat` runs the main agent pipeline (skills tools, Mem0, `cli_run` with approvals, `a2a_send`, compaction, etc.). Logic lives in `src/lib/chat/run-chat-post.ts`.

### Data directory

- By default, persisted files use **`<cwd>/.data/`** (see `src/lib/data-root.ts`).
- Override with env **`LLM_TASK_DATA_PATH`** (absolute or relative to `cwd`).

### Example

![Chat app screenshot](docs/image.png)

### Requirements

- Node.js 20+ (recommended)
- [pnpm](https://pnpm.io/) or npm

### Run locally

From the repo root:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal).

### Useful paths

| Path | Purpose |
|------|--------|
| `system_prompt.md` | Base system prompt merged for all chats |
| `.data/global-settings.json` | Model providers, default model, CLI allowlist, skills folder path, etc. |
| `.data/agents/<uuid>/` | Per-agent `config.json`, `conversation.json`, `task-board.json`, `skills/`, Mem0 |
| `.data/a2a-inbox.jsonl` | A2A message log (when used) |
| `src/app/api/chat/route.ts` | Thin wrapper; delegates to `runChatPost` |
| `src/app/settings/page.tsx` | Global settings UI (models, CLI allowlist, skills) |
| `src/lib/chat/run-chat-post.ts` | `read_task_board` / `update_task_board` tools (persist `task-board.json`) |

### HTTP API (selected)

| Method | Path | Purpose |
|--------|------|--------|
| `POST` | `/api/chat` | Streaming chat (AI SDK UI message stream) |
| `GET` / `POST` | `/api/agents` | List / create agents |
| `GET` / `PATCH` / `DELETE` | `/api/agents/[id]` | Read / update / delete agent |
| `GET` / `PUT` | `/api/agents/[id]/messages` | Load / save conversation JSON |
| `GET` / `PUT` | `/api/agents/[id]/task-board` | Load / save `task-board.json` |
| `GET` / `PATCH` | `/api/settings` | Global settings |

### Environment

Create `.env.local` as needed for your providers (OpenAI / Ollama / DeepSeek API keys and base URLs). Exact variables depend on **Settings → General** and per-agent provider selection.

Optional Mem0-related variables are used when long-term memory is enabled (see `src/lib/agent/mem0-service.ts`).

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Next.js ESLint |
| `pnpm test` | Jest |
| `npm run prepare:npm` | After `npm run build`, writes `npm-publish/` (standalone + `bin` + minimal `package.json`) |
| `npm run publish:npm` | `build` → `prepare:npm` → `npm publish ./npm-publish --access public` |

From a dev clone you can also run **`./bin/llm-agent.js`** after **`pnpm build`**: it starts **`.next/standalone/server.js`** when static assets were copied (`postbuild`), otherwise falls back to **`next start`** if `next` is installed.

### Publish to npm (maintainers)

1. Bump **`version`** in **`package.json`** (repo root).
2. **`npm run publish:npm`** — builds the app, runs **`scripts/prepare-npm-publish.mjs`**, and publishes **only** the contents of **`npm-publish/`** (Next standalone under `.next/standalone/`, plus **`bin/llm-agent.js`**, and a **minimal** `package.json` whose **`dependencies`** are only **`next`**, **`react`**, and **`react-dom`** — not the full app graph).
3. Or tag to run CI: **`./scripts/publish-chat-tag.sh`** (uses root `package.json` version → `chat-v*` tag → GitHub Actions publishes `./npm-publish`).

The published package is meant as a **production server bundle**, not as a library of React/source imports. The tarball does **not** include nested `node_modules` (npm never packs them); **`npm-publish/package.json`** (at the **root** of that folder) declares **`next`**, **`react`**, and **`react-dom`** so `npm install -g` installs those at the package root and `require("next")` in the standalone server resolves correctly. Do not use **`npm-publish/.next/standalone/package.json`** as the install manifest — that file is copied by **`next build`** and is not what npm reads when you publish **`./npm-publish`**.

### Global install (`llm-agent` CLI)

After publishing:

```bash
npm install -g @frankzye/llm-agent
llm-agent
```

Optional: **`PORT=8080 llm-agent`**, **`HOSTNAME=127.0.0.1`**. Data directory follows **`LLM_TASK_DATA_PATH`** / **`.data`** in the **current working directory** when the process runs (set `cwd` or env as needed).

---

## Contributing

This is a personal repo; fork or copy under the terms of the MIT license if you find it useful.
