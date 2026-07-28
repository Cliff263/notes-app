/**
 * Files live in the database as bytes rather than in object storage, which is
 * the right trade at this size: no second service to configure, no signed URLs
 * to expire, and an attachment is deleted by the same cascade that deletes the
 * note. The cap below is what keeps that trade sane.
 */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const MAX_DATABASE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * An allowlist rather than a blocklist, because the endpoint serves whatever it
 * stored back to a browser. Nothing here can be executed by one.
 */
export const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "video/mpeg": "mpeg",
  "video/ogg": "ogv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/flac": "flac",
  "audio/webm": "weba",
};

export function isAllowedMime(mime: string) {
  return Object.hasOwn(ALLOWED_MIME, mime);
}

export function attachmentMime(reported: string, filename: string) {
  if (isAllowedMime(reported)) return reported;
  const extension = filename.split(".").pop()?.toLowerCase();
  return (
    Object.entries(ALLOWED_MIME).find(([, value]) => value === extension)?.[0] ??
    reported
  );
}

export function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

export function isInlinePreviewMime(mime: string) {
  return (
    isImageMime(mime) ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet" ||
    mime === "application/vnd.oasis.opendocument.text"
  );
}

export function attachmentKind(mime: string, filename = "") {
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "application/pdf") return "PDF";
  if (/spreadsheet|excel|csv/.test(mime)) return "Spreadsheet";
  if (/word|document|opendocument\.text/.test(mime)) return "Document";
  if (/presentation|powerpoint/.test(mime)) return "Presentation";
  return filename.split(".").pop()?.toUpperCase() || "File";
}

export function attachmentSrc(id: string) {
  return `/api/attachments/${id}`;
}

/** The attachment id inside a markdown source, or null if it points elsewhere. */
export function attachmentIdFrom(src: string) {
  const match = /^\/api\/attachments\/([\w-]+)/.exec(src);
  return match ? match[1] : null;
}

/** The markdown a freshly uploaded file should insert. */
export function attachmentMarkdown(file: { id: string; filename: string; mime: string }) {
  const src = attachmentSrc(file.id);
  return isImageMime(file.mime)
    ? `![${file.filename}](${src})`
    : `[${file.filename}](${src})`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
