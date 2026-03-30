import type { UIMessage } from "ai";

function textFromParts(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function getLastUserMessageText(messages: UIMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") {
      const t = textFromParts(m);
      if (t.trim()) return t;
    }
  }
  return undefined;
}
