"use client";

import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAttachment,
} from "@assistant-ui/react";
import { useEffect, useState, type FC } from "react";

function isDataImageUrl(s: string | undefined): boolean {
  return !!s && s.startsWith("data:image/");
}

function useAttachmentImagePreview(): {
  imgSrc: string | undefined;
  showImage: boolean;
} {
  const type = useAttachment((a) => a.type);
  const name = useAttachment((a) => a.name);
  const file = useAttachment((a) => (a.type === "image" ? a.file : undefined));
  const fromContent = useAttachment((a) => {
    const part = a.content?.find((p) => p.type === "image");
    return part?.type === "image" ? part.image : undefined;
  });
  const hasImagePart = useAttachment((a) =>
    a.content?.some((p) => p.type === "image"),
  );

  const [objectUrl, setObjectUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!file) {
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const nameDataUrl = isDataImageUrl(name) ? name : undefined;
  const imgSrc = objectUrl ?? fromContent ?? nameDataUrl;
  const showImage =
    !!imgSrc &&
    (type === "image" || isDataImageUrl(name) || !!hasImagePart);

  return { imgSrc, showImage };
}

const ComposerAttachmentTile: FC = () => {
  const type = useAttachment((a) => a.type);
  const name = useAttachment((a) => a.name);
  const { imgSrc, showImage } = useAttachmentImagePreview();

  return (
    <AttachmentPrimitive.Root className="group relative inline-flex max-w-[200px]">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 pr-7 text-xs text-[var(--text)]">
        {showImage && imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="size-10 shrink-0 rounded object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-white/5 text-[var(--muted)]">
            {type === "image" ? "IMG" : type === "document" ? "DOC" : "FILE"}
          </span>
        )}
        <span
          className="min-w-0 truncate"
          title={isDataImageUrl(name) ? "Image" : name}
        >
          {isDataImageUrl(name) ? "Image" : <AttachmentPrimitive.Name />}
        </span>
      </div>
      <AttachmentPrimitive.Remove
        type="button"
        className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--border)] text-[10px] text-[var(--text)] opacity-0 transition-opacity hover:bg-red-900/80 group-hover:opacity-100"
        aria-label="Remove attachment"
      >
        ×
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

const MessageAttachmentTile: FC = () => {
  const type = useAttachment((a) => a.type);
  const name = useAttachment((a) => a.name);
  const { imgSrc, showImage } = useAttachmentImagePreview();

  return (
    <AttachmentPrimitive.Root className="mb-2 inline-flex max-w-[220px]">
      <div className="flex items-center gap-2 rounded-lg border border-[#dadce0] bg-white px-2 py-1.5 text-xs text-[#1f1f1f] dark:border-[var(--border)] dark:bg-white/[0.03] dark:text-[var(--text)]">
        {showImage && imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="size-12 shrink-0 rounded object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded bg-black/[0.04] text-[10px] text-[#70757a] dark:bg-white/5 dark:text-[var(--muted)]">
            {type === "image" ? "IMG" : type === "document" ? "DOC" : "FILE"}
          </span>
        )}
        <span
          className="min-w-0 truncate"
          title={isDataImageUrl(name) ? "Image" : name}
        >
          {isDataImageUrl(name) ? "Image" : <AttachmentPrimitive.Name />}
        </span>
      </div>
    </AttachmentPrimitive.Root>
  );
};

const composerComponents = {
  Image: ComposerAttachmentTile,
  Document: ComposerAttachmentTile,
  File: ComposerAttachmentTile,
};

const messageComponents = {
  Image: MessageAttachmentTile,
  Document: MessageAttachmentTile,
  File: MessageAttachmentTile,
};

/** Gemini-style 120×120 thumbnail row (see assistant-ui gemini example). */
export const GeminiComposerAttachment: FC = () => {
  const { imgSrc, showImage } = useAttachmentImagePreview();

  return (
    <AttachmentPrimitive.Root className="group/thumbnail relative shrink-0">
      <div
        className="overflow-hidden rounded-lg border border-[#dadce0] shadow-sm hover:border-[#c4c7c5] hover:shadow-md dark:border-[#3c4043] dark:hover:border-[#5f6368]"
        style={{ width: 120, height: 120, minWidth: 120, minHeight: 120 }}
      >
        {showImage && imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-full w-full object-cover transition duration-300"
            alt=""
            src={imgSrc}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#70757a] dark:text-[#9aa0a6]">
            <AttachmentPrimitive.unstable_Thumb className="text-xs" />
          </div>
        )}
      </div>
      <AttachmentPrimitive.Remove
        type="button"
        className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#70757a] opacity-0 backdrop-blur-sm transition-all hover:bg-[#f1f3f4] hover:text-[#1f1f1f] group-focus-within/thumbnail:opacity-100 group-hover/thumbnail:opacity-100 dark:border-[#3c4043] dark:bg-[#1e1f20] dark:text-[#9aa0a6] dark:hover:bg-[#2b2c2f] dark:hover:text-[#e3e3e3]"
        aria-label="Remove attachment"
      >
        ×
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

const geminiComposerComponents = {
  Image: GeminiComposerAttachment,
  Document: GeminiComposerAttachment,
  File: GeminiComposerAttachment,
};

export const ComposerAttachments: FC = () => (
  <ComposerPrimitive.Attachments components={composerComponents} />
);

export const GeminiComposerAttachments: FC = () => (
  <ComposerPrimitive.Attachments components={geminiComposerComponents} />
);

export const ComposerAddAttachment: FC = () => (
  <ComposerPrimitive.AddAttachment
    type="button"
    className="shrink-0 rounded-lg border border-dashed border-[#dadce0] px-3 py-2 text-sm text-[#70757a] hover:border-[#1a73e8] hover:bg-black/[0.04] hover:text-[#1f1f1f] dark:border-[var(--border)] dark:text-[var(--muted)] dark:hover:border-[var(--accent)] dark:hover:bg-white/[0.04] dark:hover:text-[var(--text)]"
    aria-label="Add attachment"
  >
    + File
  </ComposerPrimitive.AddAttachment>
);

export const UserMessageAttachments: FC = () => (
  <MessagePrimitive.Attachments components={messageComponents} />
);
