import type { ExportFormat } from "./types";

export const SHARE_FILE_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
  { value: "md", label: "Markdown" },
] as const satisfies ReadonlyArray<{ value: ExportFormat; label: string }>;

export type ShareFileFormat = (typeof SHARE_FILE_FORMATS)[number]["value"];
export type ShareFileResult = "shared" | "downloaded" | "cancelled";

function noteTitle(title: string) {
  return title.trim() || "Untitled note";
}

export function noteExportUrl(noteId: string, format: ShareFileFormat) {
  return `/api/notes/${encodeURIComponent(noteId)}/export?format=${format}`;
}

export function attachmentFilename(header: string | null, fallback: string) {
  if (!header) return fallback;

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the regular filename parameter.
    }
  }

  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? fallback;
}

function fallbackFilename(title: string, format: ShareFileFormat) {
  const slug =
    noteTitle(title)
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "note";
  return `${slug}.${format}`;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Fetches the same real export used by the download menu and gives that File
 * to the operating system's share sheet. Web pages cannot select a particular
 * destination or attach files through mailto:/wa.me URLs; the OS share sheet
 * is the portable route to Mail, WhatsApp, and their recipient pickers.
 */
export async function shareNoteFile(
  noteId: string,
  title: string,
  format: ShareFileFormat,
): Promise<ShareFileResult> {
  const response = await fetch(noteExportUrl(noteId, format), {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Could not export note (${response.status})`);
  }

  const blob = await response.blob();
  const filename = attachmentFilename(
    response.headers.get("Content-Disposition"),
    fallbackFilename(title, format),
  );
  // text/markdown is not accepted by every native share implementation.
  const mime = format === "md" ? "text/plain" : blob.type;
  const file = new File([blob], filename, { type: mime });
  const data: ShareData = { files: [file], title: noteTitle(title) };

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(data)
  ) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // A browser can report support and still reject a particular target or
      // lose transient activation. Preserve the file through a download.
    }
  }

  download(file);
  return "downloaded";
}
