import { createDeepSeek } from "@ai-sdk/deepseek";
import { getDeepSeek } from "@/lib/deepseek-provider";

jest.mock("@ai-sdk/deepseek", () => ({
  createDeepSeek: jest.fn(() => ({ chat: jest.fn() })),
}));

const createDeepSeekMock = createDeepSeek as jest.Mock;

describe("getDeepSeek", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it("passes apiKey and trimmed baseURL when env exists", () => {
    process.env.DEEPSEEK_API_KEY = "k1";
    process.env.DEEPSEEK_BASE_URL = "  https://api.deepseek.com  ";

    const client = getDeepSeek();

    expect(createDeepSeekMock).toHaveBeenCalledWith({
      apiKey: "k1",
      baseURL: "https://api.deepseek.com",
    });
    expect(client).toBeTruthy();
  });

  it("uses overrides over env", () => {
    process.env.DEEPSEEK_API_KEY = "env-key";
    process.env.DEEPSEEK_BASE_URL = "https://env.example";

    getDeepSeek({
      apiKey: "override-key",
      baseURL: "https://override.example",
    });

    expect(createDeepSeekMock).toHaveBeenCalledWith({
      apiKey: "override-key",
      baseURL: "https://override.example",
    });
  });
});
