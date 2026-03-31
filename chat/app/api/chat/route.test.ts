import { streamText } from "ai";
import { getOllama } from "@/lib/ollama-provider";

describe("POST /api/chat reasoning", () => {
  test.concurrent(
    "uses selected model and calls streamText",
    async () => {
      const ollama = getOllama();
      const model = ollama.chat("qwen3.5:0.8b", {
        think: true,
      });

      const textStream = await streamText({
        model: model,
        prompt: "what is your name",
      });

      for await (const part of textStream.fullStream) {
        console.log(part);
      }
    },
    100000000,
  );
});
