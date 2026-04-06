import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import {
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  getOpenAI,
} from "@/src/lib/openai-provider";

jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => ({ chat: jest.fn() })),
}));

const createOpenAICompatibleMock = createOpenAICompatible as jest.Mock;

describe("getOpenAI", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it("passes apiKey and trimmed baseURL when OPENAI_BASE_URL exists", () => {
    process.env.OPENAI_API_KEY = "k1";
    process.env.OPENAI_BASE_URL = "  http://localhost:11434/v1  ";

    const client = getOpenAI();

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith({
      name: "openai-compatible",
      apiKey: "k1",
      baseURL: "http://localhost:11434/v1",
    });
    expect(client).toBeTruthy();
  });

  it("defaults baseURL to official OpenAI API when OPENAI_BASE_URL is empty", () => {
    process.env.OPENAI_API_KEY = "k2";
    process.env.OPENAI_BASE_URL = "   ";

    getOpenAI();

    expect(createOpenAICompatibleMock).toHaveBeenCalledWith({
      name: "openai-compatible",
      apiKey: "k2",
      baseURL: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    });
  });
});
