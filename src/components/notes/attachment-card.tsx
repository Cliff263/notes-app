"use client";

import { unzipSync } from "fflate";
import {
  Download,
  ExternalLink,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkdownDocument,
  PdfDocument,
  PresentationDocument,
  SpreadsheetDocument,
  TextDocument,
} from "@/components/notes/attachment-viewers";
import {
  attachmentKind,
  attachmentMime,
  attachmentSrc,
  formatBytes,
} from "@/lib/attachments";

type Metadata = {
  id: string;
  filename: string;
  mime: string;
  size: number;
  kind: string;
  previewable: boolean;
};

export function AttachmentCard({
  id,
  filename,
  shareToken,
  onRemove,
}: {
  id: string;
  filename: string;
  shareToken?: string;
  onRemove?: () => void;
}) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const query = shareToken ? `&token=${encodeURIComponent(shareToken)}` : "";
  const rawUrl = `${attachmentSrc(id)}?inline=1${query}`;
  const downloadUrl = `${attachmentSrc(id)}?download=1${query}`;

  useEffect(() => {
    let active = true;
    void fetch(`${attachmentSrc(id)}?meta=1${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data) setMetadata(data as Metadata);
      });
    return () => {
      active = false;
    };
  }, [id, query]);

  const kind = metadata?.kind ?? attachmentKind("", filename);

  async function remove() {
    if (!onRemove || removing) return;
    setRemoving(true);
    const response = await fetch(attachmentSrc(id), { method: "DELETE" }).catch(
      () => null,
    );
    setRemoving(false);
    if (response?.ok) onRemove();
  }

  return (
    <span className="my-2 flex max-w-xl items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-panel text-glow-2">
          {iconFor(kind)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-foreground">
            {metadata?.filename ?? filename}
          </span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.1em] text-muted-2">
            {kind}
            {metadata ? ` · ${formatBytes(metadata.size)}` : ""}
          </span>
        </span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-2" />
      </button>

      <a
        href={downloadUrl}
        download
        aria-label={`Download ${filename}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-2 transition hover:bg-panel hover:text-foreground"
      >
        <Download className="size-3.5" />
      </a>
      {onRemove && (
        <button
          type="button"
          disabled={removing}
          onClick={() => void remove()}
          aria-label={`Remove ${filename}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-2 transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {open && (
        <AttachmentViewer
          metadata={metadata}
          fallback={{ id, filename, kind }}
          rawUrl={rawUrl}
          downloadUrl={downloadUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function AttachmentViewer({
  metadata,
  fallback,
  rawUrl,
  downloadUrl,
  onClose,
}: {
  metadata: Metadata | null;
  fallback: { id: string; filename: string; kind: string };
  rawUrl: string;
  downloadUrl: string;
  onClose: () => void;
}) {
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const filename = metadata?.filename ?? fallback.filename;
  const mime = attachmentMime(metadata?.mime ?? "", filename);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const docxPreview = extension === "docx";
  const pdfPreview = mime === "application/pdf" || extension === "pdf";
  const markdownPreview = ["md", "markdown", "mdown"].includes(extension);
  const spreadsheetPreview = ["xlsx", "csv", "tsv", "ods"].includes(extension);
  const presentationPreview = extension === "pptx";
  const modernOffice = /\.(docx|pptx|xlsx|odt|ods)$/i.test(filename);
  const textPreview =
    mime.startsWith("text/") ||
    markdownPreview ||
    ["csv", "tsv", "ods", "odt"].includes(extension);
  const structuredBinaryPreview =
    docxPreview || pdfPreview || extension === "xlsx" || presentationPreview;
  const binaryPreview =
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/");
  const handleDocumentError = useCallback(() => setLoadError(true), []);

  useEffect(() => {
    if (!textPreview) return;
    let active = true;
    void fetch(rawUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load attachment");
        if (modernOffice && ["ods", "odt"].includes(extension)) {
          return extractOfficeText(
            new Uint8Array(await response.arrayBuffer()),
            filename,
          );
        }
        return response.text();
      })
      .then((text) => {
        if (active) setDocumentText(text);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [extension, filename, modernOffice, rawUrl, textPreview]);

  useEffect(() => {
    if (!structuredBinaryPreview) return;
    let active = true;
    void fetch(rawUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load attachment");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (active) setFileBuffer(buffer);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [rawUrl, structuredBinaryPreview]);

  useEffect(() => {
    if (!binaryPreview) return;
    let active = true;
    let objectUrl: string | null = null;
    void fetch(rawUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load attachment");
        const bytes = await response.arrayBuffer();
        return new Blob([bytes], { type: mime });
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [binaryPreview, mime, rawUrl]);

  const content = useMemo(() => {
    if (loadError) {
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <File className="size-12 text-muted-2" />
          <p className="text-[13px] font-medium">This attachment could not be loaded.</p>
          <p className="max-w-sm text-[11px] text-muted-2">
            Check your connection and storage credentials, or download the original file.
          </p>
        </div>
      );
    }
    if (binaryPreview && !previewUrl) {
      return <p className="text-[12px] text-zinc-400">Loading preview…</p>;
    }
    if (structuredBinaryPreview && !fileBuffer) {
      return <p className="text-[12px] text-zinc-400">Preparing document…</p>;
    }
    if (docxPreview && fileBuffer) {
      return (
        <DocxDocument
          blob={new Blob([fileBuffer], { type: mime })}
          filename={filename}
          onError={handleDocumentError}
        />
      );
    }
    if (pdfPreview && fileBuffer) {
      return (
        <PdfDocument
          data={fileBuffer}
          filename={filename}
          onError={handleDocumentError}
        />
      );
    }
    if (presentationPreview && fileBuffer) {
      return (
        <PresentationDocument
          data={fileBuffer}
          filename={filename}
          onError={handleDocumentError}
        />
      );
    }
    if (spreadsheetPreview) {
      return (
        <SpreadsheetDocument
          data={extension === "xlsx" ? fileBuffer ?? undefined : undefined}
          text={extension === "xlsx" ? undefined : documentText ?? undefined}
          extension={extension}
          filename={filename}
          onError={handleDocumentError}
        />
      );
    }
    if (mime.startsWith("image/")) {
      return (
        // Blob URLs are authenticated user attachments, not optimizable assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl!}
          alt={filename}
          onError={() => setLoadError(true)}
          className="max-h-full max-w-full object-contain"
        />
      );
    }
    if (mime.startsWith("video/")) {
      return (
        <video
          src={previewUrl!}
          controls
          autoPlay
          onError={() => setLoadError(true)}
          className="max-h-full max-w-full"
        />
      );
    }
    if (mime.startsWith("audio/")) {
      return (
        <audio
          src={previewUrl!}
          controls
          autoPlay
          onError={() => setLoadError(true)}
          className="w-full max-w-xl"
        />
      );
    }
    if (markdownPreview) {
      return <MarkdownDocument text={documentText ?? ""} />;
    }
    if (textPreview) {
      return <TextDocument text={documentText ?? ""} />;
    }
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <File className="size-12 text-muted-2" />
        <p className="text-[13px] font-medium">Preview is not available for this format.</p>
        <p className="max-w-sm text-[11px] text-muted-2">
          The original file is safely stored and can be downloaded without conversion.
        </p>
      </div>
    );
  }, [
    binaryPreview,
    docxPreview,
    documentText,
    extension,
    fileBuffer,
    filename,
    handleDocumentError,
    loadError,
    markdownPreview,
    mime,
    pdfPreview,
    presentationPreview,
    previewUrl,
    spreadsheetPreview,
    structuredBinaryPreview,
    textPreview,
  ]);

  return (
    <span
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${filename}`}
      className="fixed inset-0 z-[80] flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <span
        className="flex items-center gap-3 border-b border-white/10 bg-zinc-950 px-4 py-3 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{filename}</span>
          <span className="block text-[10px] uppercase tracking-[0.1em] text-zinc-400">
            {metadata?.kind ?? fallback.kind}
            {metadata ? ` · ${formatBytes(metadata.size)}` : ""}
          </span>
        </span>
        <a
          href={downloadUrl}
          download
          className="flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-[11px] text-zinc-200 hover:bg-white/10"
        >
          <Download className="size-3.5" />
          Download
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close attachment"
          className="flex size-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </span>
      <span
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto text-white"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </span>
    </span>
  );
}

function DocxDocument({
  blob,
  filename,
  onError,
}: {
  blob: Blob;
  filename: string;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    container.replaceChildren();

    void import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(blob, container, container, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderChanges: true,
          renderComments: true,
          renderAltChunks: true,
          useBase64URL: true,
          experimental: true,
        }),
      )
      .catch(() => {
        if (active) onError();
      });

    return () => {
      active = false;
      container.replaceChildren();
    };
  }, [blob, onError]);

  return (
    <div
      ref={containerRef}
      role="document"
      aria-label={filename}
      className="docx-viewer-canvas h-full min-h-[36rem] w-full overflow-auto bg-zinc-800 text-zinc-900 scroll-thin"
    />
  );
}

function extractOfficeText(bytes: Uint8Array, filename: string) {
  const files = unzipSync(bytes);
  const decoder = new TextDecoder();
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "xlsx") return extractWorkbook(files, decoder);
  if (extension === "ods") {
    const content = files["content.xml"];
    if (!content) return "This spreadsheet contains no extractable cells.";
    const xml = new DOMParser().parseFromString(
      decoder.decode(content),
      "application/xml",
    );
    return (
      [...xml.getElementsByTagName("*")]
        .filter((node) => node.localName === "table-row")
        .map((row) =>
          [...row.children]
            .filter((cell) => cell.localName === "table-cell")
            .map((cell) =>
              [...cell.getElementsByTagName("*")]
                .filter((node) => node.localName === "p")
                .map((node) => node.textContent ?? "")
                .join("\n"),
            )
            .join("\t"),
        )
        .join("\n") || "This spreadsheet contains no extractable cells."
    );
  }
  const paths =
    extension === "docx"
      ? ["word/document.xml"]
      : extension === "pptx"
        ? Object.keys(files)
            .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
            .sort(naturalSort)
        : ["content.xml"];

  const sections = paths.flatMap((path) => {
    const file = files[path];
    if (!file) return [];
    const xml = new DOMParser().parseFromString(decoder.decode(file), "application/xml");
    const paragraphs = [...xml.getElementsByTagName("*")].filter((node) =>
      ["p", "row"].includes(node.localName),
    );
    if (paragraphs.length) {
      return paragraphs
        .map((node) =>
          [...node.getElementsByTagName("*")]
            .filter((child) => ["t", "v"].includes(child.localName))
            .map((child) => child.textContent ?? "")
            .join(extension === "xlsx" ? "\t" : ""),
        )
        .filter(Boolean);
    }
    return [
      [...xml.getElementsByTagName("*")]
        .filter((node) => node.localName === "t")
        .map((node) => node.textContent ?? "")
        .join(" "),
    ];
  });
  return sections.join("\n\n") || "This document contains no extractable text.";
}

function extractWorkbook(files: Record<string, Uint8Array>, decoder: TextDecoder) {
  const parse = (path: string) => {
    const file = files[path];
    return file
      ? new DOMParser().parseFromString(decoder.decode(file), "application/xml")
      : null;
  };
  const sharedXml = parse("xl/sharedStrings.xml");
  const shared = sharedXml
    ? [...sharedXml.getElementsByTagName("*")]
        .filter((node) => node.localName === "si")
        .map((item) =>
          [...item.getElementsByTagName("*")]
            .filter((node) => node.localName === "t")
            .map((node) => node.textContent ?? "")
            .join(""),
        )
    : [];

  const sheets = Object.keys(files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort(naturalSort);

  return (
    sheets
      .flatMap((path, index) => {
        const xml = parse(path);
        if (!xml) return [];
        const rows = [...xml.getElementsByTagName("*")].filter(
          (node) => node.localName === "row",
        );
        return [
          `Sheet ${index + 1}`,
          ...rows.map((row) =>
            [...row.children]
              .filter((cell) => cell.localName === "c")
              .map((cell) => {
                const value = [...cell.getElementsByTagName("*")].find(
                  (node) => node.localName === "v" || node.localName === "t",
                )?.textContent;
                return cell.getAttribute("t") === "s"
                  ? shared[Number(value)] ?? ""
                  : value ?? "";
              })
              .join("\t"),
          ),
          "",
        ];
      })
      .join("\n")
      .trim() || "This workbook contains no extractable cells."
  );
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function iconFor(kind: string) {
  switch (kind) {
    case "Image":
      return <FileImage className="size-5" />;
    case "Video":
      return <FileVideo className="size-5" />;
    case "Audio":
      return <FileAudio className="size-5" />;
    case "Spreadsheet":
      return <FileSpreadsheet className="size-5" />;
    case "Presentation":
      return <Presentation className="size-5" />;
    case "Document":
    case "PDF":
      return <FileText className="size-5" />;
    default:
      return <File className="size-5" />;
  }
}
