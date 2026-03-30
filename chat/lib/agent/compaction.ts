import type { UIMessage } from "ai";
import { generateText } from "ai";
import type { LanguageModel } from "ai";

function messageChars(messages: UIMessage[]): number {
  return messages.reduce((acc, m) => {
    const text = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return acc + text.length;
  }, 0);
}

/**
 * When the transcript is large, summarize older turns and keep recent messages.
 * Runs server-side (hook), not exposed as a user tool by default.
 */
export async function autoCompactMessages(
  messages: UIMessage[],
  model: LanguageModel,
  opts?: { maxChars?: number; keepLast?: number },
): Promise<{ messages: UIMessage[]; systemAddendum?: string }> {
  const maxChars = opts?.maxChars ?? 14_000;
  const keepLast = opts?.keepLast ?? 8;
  if (messages.length <= keepLast || messageChars(messages) <= maxChars) {
    return { messages };
  }

  const head = messages.slice(0, -keepLast);
  const tail = messages.slice(-keepLast);

  const transcript = head
    .map((m) => {
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      return `${m.role}: ${text}`;
    })
    .join("\n\n");

  const { text: summary } = await generateText({
    model,
    system:
      "Summarize the conversation excerpt for future context. Preserve facts, decisions, and open tasks. Be concise.",
    prompt: transcript.slice(0, 24_000),
  });

  const systemAddendum = `Earlier conversation (compressed):\n${summary}`;

  return { messages: tail, systemAddendum };
}
