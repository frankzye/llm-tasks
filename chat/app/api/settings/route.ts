import { NextResponse } from "next/server";

import {
  patchGlobalSettings,
  readGlobalSettings,
  type GlobalSettings,
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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid fields (skillsFolderPath, chatModels, defaultChatModel, provider, providerBaseUrl, providerApiKey)",
      },
      { status: 400 },
    );
  }

  if (patch.defaultChatModel) {
    const cur = await readGlobalSettings(cwd);
    const models = patch.chatModels ?? cur.chatModels ?? [];
    if (models.length > 0 && !models.includes(patch.defaultChatModel)) {
      return NextResponse.json(
        { error: "defaultChatModel must exist in chatModels" },
        { status: 400 },
      );
    }
  }

  const next = await patchGlobalSettings(cwd, patch);
  return NextResponse.json(next);
}
