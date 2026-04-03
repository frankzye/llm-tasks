import { NextResponse } from "next/server";

import { normalizeCliAlwaysAllowList } from "@/lib/agent/cli";
import {
  patchGlobalSettings,
  readGlobalSettings,
  type GlobalSettings,
  type ModelProviderConfig,
} from "@/lib/global-settings";

export async function GET() {
  const cwd = process.cwd();
  const s = await readGlobalSettings(cwd);
  return NextResponse.json(s);
}

export async function PATCH(req: Request) {
  const cwd = process.cwd();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const addCliAlwaysRaw =
    typeof body.addCliAlwaysAllowCommand === "string"
      ? body.addCliAlwaysAllowCommand.trim()
      : "";

  const patch: Partial<GlobalSettings> = {};

  if ("skillsFolderPath" in body) {
    if (body.skillsFolderPath === null || body.skillsFolderPath === "") {
      patch.skillsFolderPath = null;
    } else if (typeof body.skillsFolderPath === "string") {
      patch.skillsFolderPath = body.skillsFolderPath.trim() || null;
    }
  }
  if ("chatModels" in body && Array.isArray(body.chatModels)) {
    const models = body.chatModels
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
    patch.chatModels = [...new Set(models)];
  }
  if ("defaultChatModel" in body) {
    if (body.defaultChatModel === null || body.defaultChatModel === "") {
      patch.defaultChatModel = undefined;
    } else if (typeof body.defaultChatModel === "string") {
      patch.defaultChatModel = body.defaultChatModel.trim();
    }
  }
  if ("provider" in body) {
    if (body.provider === null || body.provider === "") {
      patch.provider = undefined;
    } else if (
      body.provider === "openai" ||
      body.provider === "ollama" ||
      body.provider === "deepseek"
    ) {
      patch.provider = body.provider;
    }
  }
  if ("providerBaseUrl" in body) {
    if (body.providerBaseUrl === null || body.providerBaseUrl === "") {
      patch.providerBaseUrl = null;
    } else if (typeof body.providerBaseUrl === "string") {
      patch.providerBaseUrl = body.providerBaseUrl.trim() || null;
    }
  }
  if ("providerApiKey" in body) {
    if (body.providerApiKey === null || body.providerApiKey === "") {
      patch.providerApiKey = null;
    } else if (typeof body.providerApiKey === "string") {
      patch.providerApiKey = body.providerApiKey.trim() || null;
    }
  }
  if ("modelProviders" in body && Array.isArray(body.modelProviders)) {
    const nextProviders: ModelProviderConfig[] = [];
    for (const row of body.modelProviders) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      if (
        typeof r.id !== "string" ||
        !r.id.trim() ||
        (r.kind !== "openai" && r.kind !== "ollama" && r.kind !== "deepseek")
      ) {
        continue;
      }
      const models = Array.isArray(r.models)
        ? r.models
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
      if (models.length === 0) continue;
      nextProviders.push({
        id: r.id.trim(),
        kind: r.kind,
        baseUrl:
          r.baseUrl === null || r.baseUrl === ""
            ? null
            : typeof r.baseUrl === "string"
              ? r.baseUrl.trim() || null
              : null,
        apiKey:
          r.apiKey === null || r.apiKey === ""
            ? null
            : typeof r.apiKey === "string"
              ? r.apiKey.trim() || null
              : null,
        models: [...new Set(models)],
      });
    }
    patch.modelProviders = nextProviders;
  }
  if ("defaultChatProvider" in body) {
    if (body.defaultChatProvider === null || body.defaultChatProvider === "") {
      patch.defaultChatProvider = undefined;
    } else if (typeof body.defaultChatProvider === "string") {
      patch.defaultChatProvider = body.defaultChatProvider.trim();
    }
  }
  if ("cliAlwaysAllowCommands" in body && Array.isArray(body.cliAlwaysAllowCommands)) {
    const cmds = body.cliAlwaysAllowCommands.filter(
      (x): x is string => typeof x === "string",
    );
    patch.cliAlwaysAllowCommands = normalizeCliAlwaysAllowList(cmds);
  }
  if (addCliAlwaysRaw) {
    const cur = await readGlobalSettings(cwd);
    const [bin] = normalizeCliAlwaysAllowList([addCliAlwaysRaw]);
    if (!bin) {
      return NextResponse.json(
        { error: "Invalid addCliAlwaysAllowCommand" },
        { status: 400 },
      );
    }
    const prev = cur.cliAlwaysAllowCommands ?? [];
    const already = prev.some((p) => p.toLowerCase() === bin.toLowerCase());
    if (!already) {
      patch.cliAlwaysAllowCommands = normalizeCliAlwaysAllowList([...prev, bin]);
    }
  }

  if (Object.keys(patch).length === 0) {
    if (addCliAlwaysRaw) {
      return NextResponse.json(await readGlobalSettings(cwd));
    }
    return NextResponse.json(
      {
        error:
          "No valid fields (skillsFolderPath, chatModels, defaultChatModel, provider, providerBaseUrl, providerApiKey, modelProviders, defaultChatProvider, cliAlwaysAllowCommands, addCliAlwaysAllowCommand)",
      },
      { status: 400 },
    );
  }

  if (patch.defaultChatModel) {
    const cur = await readGlobalSettings(cwd);
    const models =
      patch.chatModels ??
      cur.chatModels ??
      (patch.modelProviders ?? cur.modelProviders ?? []).flatMap((p) => p.models);
    if (models.length > 0 && !models.includes(patch.defaultChatModel)) {
      return NextResponse.json(
        { error: "defaultChatModel must exist in chatModels" },
        { status: 400 },
      );
    }
  }
  if (patch.defaultChatProvider) {
    const cur = await readGlobalSettings(cwd);
    const providers = patch.modelProviders ?? cur.modelProviders ?? [];
    if (providers.length > 0 && !providers.some((p) => p.id === patch.defaultChatProvider)) {
      return NextResponse.json(
        { error: "defaultChatProvider must exist in modelProviders" },
        { status: 400 },
      );
    }
  }

  const next = await patchGlobalSettings(cwd, patch);
  return NextResponse.json(next);
}
