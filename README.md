# llm-tasks

Personal workspace for LLM-related experiments: a **Next.js chat app** with agents, skills, and optional tooling, plus other subprojects.

## License

This project is licensed under the [MIT License](LICENSE).

---

## Chat app (`chat/`)

A local-first assistant UI built with **Next.js**, **assistant-ui**, and the **Vercel AI SDK**. Agents are stored under `.data/agents/<id>/` (config, conversation, skills). Global settings live in `.data/global-settings.json`.

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

---

## Contributing

This is a personal repo; fork or copy under the terms of the MIT license if you find it useful.
