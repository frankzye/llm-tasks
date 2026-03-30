import { createDownload, type Experimental_DownloadFunction } from "ai";

/**
 * Default AI SDK download only allows http(s). Attachment images from assistant-ui
 * arrive as data URLs; decode those locally and keep HTTP(S) downloads as-is.
 */
const httpDownload = createDownload();

function decodeDataUrl(url: URL): { data: Uint8Array; mediaType: string | undefined } {
  const raw = url.href;
  const comma = raw.indexOf(",");
  if (comma === -1) {
    throw new Error("Invalid data URL");
  }
  const header = raw.slice(0, comma);
  const body = raw.slice(comma + 1);
  const meta = header.slice("data:".length);
  const mediaType = meta.split(";")[0]?.trim() || undefined;
  const isBase64 = /;base64/i.test(meta);
  const data = isBase64
    ? new Uint8Array(Buffer.from(body, "base64"))
    : new TextEncoder().encode(decodeURIComponent(body));
  return { data, mediaType };
}

export const experimental_download: Experimental_DownloadFunction = async (
  requestedDownloads,
) => {
  return Promise.all(
    requestedDownloads.map(async (req) => {
      if (req.isUrlSupportedByModel) return null;
      if (req.url.protocol === "data:") {
        return decodeDataUrl(req.url);
      }
      return httpDownload({ url: req.url, abortSignal: undefined });
    }),
  );
};
