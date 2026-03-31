import { getOpenAI } from "@/lib/openai-provider";
import { createOpenAI } from "@ai-sdk/openai";

jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn(() => ({ chat: jest.fn() })),
}));

const createOpenAIMock = createOpenAI as jest.Mock;

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

    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: "k1",
      baseURL: "http://localhost:11434/v1",
    });
    expect(client).toBeTruthy();
  });

  it("omits baseURL when OPENAI_BASE_URL is empty", () => {
    process.env.OPENAI_API_KEY = "k2";
    process.env.OPENAI_BASE_URL = "   ";

    getOpenAI();

    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: "k2",
    });
  });
});

