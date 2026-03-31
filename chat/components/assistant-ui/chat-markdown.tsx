"use client";

/**
 * KaTeX + markdown for chat messages (assistant-ui LaTeX guide).
 * @see https://www.assistant-ui.com/docs/guides/latex
 */

import type { ReactNode } from "react";
import { MessagePartPrimitive } from "@assistant-ui/react";
import type { TextMessagePartComponent } from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Normalize common LLM LaTeX delimiters to remark-math `$` / `$$` forms. */
export function normalizeCustomMathTags(input: string): string {
  return (
    input
      .replace(/\[\/math\]([\s\S]*?)\[\/math\]/g, (_, content: string) =>
        `$$${content.trim()}$$`,
      )
      .replace(/\[\/inline\]([\s\S]*?)\[\/inline\]/g, (_, content: string) =>
        `$${content.trim()}$`,
      )
      .replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)/g, (_, content: string) =>
        `$${content.trim()}$`,
      )
      .replace(/\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (_, content: string) =>
        `$$${content.trim()}$$`,
      )
  );
}

function createMarkdownComponents(variant: "user" | "assistant") {
  const linkClass =
    variant === "user"
      ? "text-[#1a73e8] underline dark:text-[#8ab4f8]"
      : "text-[#1a73e8] underline dark:text-[#8ab4f8]";
  const codeBg =
    variant === "user"
      ? "bg-black/10 dark:bg-white/15"
      : "bg-[#e8eaed]/80 dark:bg-white/10";
  const preBg =
    variant === "user"
      ? "bg-black/10 dark:bg-white/10"
      : "bg-[#e8eaed]/90 dark:bg-[#1e1f20]";

  return {
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mb-1.5 last:mb-0">{children}</p>
    ),
    a: ({
      href,
      children,
    }: {
      href?: string;
      children?: ReactNode;
    }) => (
      <a
        href={href}
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    code: ({
      className,
      children,
      ...props
    }: {
      className?: string;
      children?: ReactNode;
    }) => {
      const isBlock = className?.includes("language-math");
      if (isBlock) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${codeBg}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }: { children?: ReactNode }) => (
      <pre
        className={`my-2 overflow-x-auto rounded-lg p-2 font-mono text-xs ${preBg}`}
      >
        {children}
      </pre>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="my-1 list-inside list-disc space-y-0.5">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="my-1 list-inside list-decimal space-y-0.5">{children}</ol>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0">
        {children}
      </h3>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="my-2 border-l-4 border-[#dadce0] pl-3 text-[#444746] dark:border-[#5f6368] dark:text-[#c4c7c5]">
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr className="my-4 border-[#dadce0] dark:border-[#3c4043]" />
    ),
  };
}

const userComponents = createMarkdownComponents("user");
const assistantComponents = createMarkdownComponents("assistant");

export const UserMessageMarkdown: TextMessagePartComponent = ({ text }) => {
  if (text.startsWith("data:image/") && text.includes("base64,")) {
    return null;
  }

  const processed = normalizeCustomMathTags(text);

  return (
    <div className="user-message-md wrap-break-word [&_.katex-display]:my-2 [&_.katex]:text-[1em]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={userComponents}
      >
        {processed}
      </ReactMarkdown>
      <MessagePartPrimitive.InProgress>
        <span className="font-[revert]">{" \u25CF"}</span>
      </MessagePartPrimitive.InProgress>
    </div>
  );
};

export const AssistantMessageMarkdown: TextMessagePartComponent = ({
  text,
}) => {
  const processed = normalizeCustomMathTags(text);

  return (
    <div className="assistant-message-md wrap-break-word [&_.katex-display]:my-2 [&_.katex]:text-[1em]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={assistantComponents}
      >
        {processed}
      </ReactMarkdown>
      <MessagePartPrimitive.InProgress>
        <span className="font-[revert]">{" \u25CF"}</span>
      </MessagePartPrimitive.InProgress>
    </div>
  );
};
