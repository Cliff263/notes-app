"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  Check,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  ListChecks,
  Paperclip,
  Pin,
  Presentation,
  RotateCcw,
  Star,
} from "lucide-react";
import { attachmentIdFrom } from "@/lib/attachments";
import {
  parseMarkdown,
  taskProgress,
  type Block,
  type Inline,
} from "@/lib/markdown";
import { highlightSegments, stripHighlights } from "@/lib/search";
import type { Note } from "@/lib/types";
import {
  cn,
  readingTime,
  relativeTime,
  shortDate,
  stripMarkdown,
  timeLabel,
} from "@/lib/utils";
import { tap } from "@/components/motion";
import { useNoteActions } from "@/hooks/use-notes";
import { useNotesStore } from "@/store/notes-store";

export function NoteCard({ note, selected }: { note: Note; selected: boolean }) {
  const select = useNotesStore((state) => state.select);
  const { updateNote, restoreNote } = useNoteActions();
  const selectMode = useNotesStore((state) => state.selectMode);
  const toggleSelected = useNotesStore((state) => state.toggleSelected);
  const checked = useNotesStore((state) => state.selectedIds.has(note.id));
  const reduced = useReducedMotion();

  const cardContent = compactCardContent(note.content);
  const excerpt = cardContent.excerpt;
  const minutes = readingTime(note.content);
  const trashed = Boolean(note.deletedAt);
  const tasks = taskProgress(note.content);
  /*
   * On a search result the server sends back the passage that matched, which is
   * far more useful than the note's opening line. It comes back as raw markdown
   * with the matched words marked, so it goes through the same tidy-up as the
   * excerpt — the markers are control characters and survive it untouched.
   */
  const snippet = note.searchSnippet
    ? highlightSegments(stripMarkdown(note.searchSnippet))
    : null;

  // A passage lifted from the middle of a note reads better with a lead-in.
  const snippetLead =
    snippet && !excerpt.startsWith(stripHighlights(snippet[0].text).slice(0, 12))
      ? "… "
      : "";

  return (
    <motion.article
      layout="position"
      layoutId={`note-${note.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      whileTap={{ scale: 0.985 }}
      onClick={() => (selectMode ? toggleSelected(note.id) : select(note.id))}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-4 transition-colors",
        selectMode && checked && "ring-1 ring-[var(--glow-1)]",
        selected
          ? "border-[color-mix(in_srgb,var(--foreground)_38%,transparent)] bg-card-hover"
          : "border-line hover:border-line-strong hover:bg-card-hover",
      )}
    >
      <div className="flex items-start gap-2">
        {selectMode ? (
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition",
              checked
                ? "border-transparent bg-btn text-btn-foreground"
                : "border-line-strong",
            )}
          >
            {checked && <Check className="size-3" />}
          </span>
        ) : (
        <motion.button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateNote(note.id, { pinned: !note.pinned });
          }}
          {...tap}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          className={cn(
            "mt-0.5 shrink-0 transition",
            note.pinned
              ? "text-foreground"
              : "hover-reveal text-muted-2 hover:text-foreground",
          )}
        >
          <Pin className={cn("size-3.5", note.pinned && "fill-current")} />
        </motion.button>
        )}

        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
          {note.title || "Untitled note"}
        </h3>

        {trashed && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              restoreNote(note.id);
            }}
            className="flex shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted transition hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Restore
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[22px]">
        <span className="inline-flex rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">
          {note.category}
        </span>

        {note.dueAt && (
          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-glow-2">
            <CalendarClock className="size-2.5" />
            {shortDate(note.dueAt)} · {timeLabel(note.dueAt)}
          </span>
        )}

        {tasks && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted"
            title={`${tasks.done} of ${tasks.total} done`}
          >
            <ListChecks className="size-2.5" />
            {tasks.done}/{tasks.total}
            <span className="h-1 w-8 overflow-hidden rounded-full bg-line">
              <motion.span
                initial={false}
                animate={{ width: `${(tasks.done / tasks.total) * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
                className={cn(
                  "block h-full rounded-full",
                  tasks.done === tasks.total ? "bg-glow-1" : "bg-muted-2",
                )}
              />
            </span>
          </span>
        )}
      </div>

      {snippet ? (
        <p className="clamp-2 mt-2.5 pl-[22px] text-[12px] leading-[1.6] text-muted">
          {snippetLead}
          {snippet.map((segment, index) =>
            segment.match ? (
              <mark
                key={index}
                className="rounded bg-[color-mix(in_srgb,var(--glow-1)_28%,transparent)] px-0.5 text-foreground"
              >
                {segment.text}
              </mark>
            ) : (
              <span key={index}>{segment.text}</span>
            ),
          )}
        </p>
      ) : (
        <CompactContent
          excerpt={excerpt}
          attachments={cardContent.attachments}
          table={cardContent.table}
        />
      )}

      <div className="mt-3 flex items-center gap-2 pl-[22px]">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-muted-2"
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-[10px] text-muted-2">+{note.tags.length - 3}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateNote(note.id, { favorite: !note.favorite });
            }}
            aria-label={note.favorite ? "Remove from favorites" : "Add to favorites"}
            className={cn(
              "transition",
              note.favorite
                ? "text-accent"
                : "hover-reveal text-muted-2 hover:text-foreground",
            )}
          >
            <Star className={cn("size-3", note.favorite && "fill-accent")} />
          </button>

          <span
            className="text-[10px] text-muted-2"
            title={`${minutes} min read`}
          >
            {relativeTime(note.updatedAt)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

type CompactAttachment = {
  id: string;
  filename: string;
};

type CompactTable = Extract<Block, { type: "table" }>;

function compactCardContent(source: string) {
  const blocks = parseMarkdown(source);
  const attachments: CompactAttachment[] = [];

  const text = blocks.flatMap((block) => {
    if (block.type === "table" || block.type === "rule") return [];
    if (block.type === "code") return block.value.trim() ? [block.value] : [];

    const content = block.content;
    content.forEach((node) => {
      if (node.type !== "link" && node.type !== "image") return;
      const source = node.type === "link" ? node.href : node.src;
      const id = attachmentIdFrom(source);
      if (!id || attachments.some((attachment) => attachment.id === id)) return;
      attachments.push({
        id,
        filename: node.value || "Attachment",
      });
    });

    const value = inlineCardText(content);
    return value ? [value] : [];
  });

  return {
    attachments,
    excerpt: text.join(" · "),
    table: blocks.find((block): block is CompactTable => block.type === "table"),
  };
}

function inlineCardText(content: Inline[]) {
  return content
    .flatMap((node) => {
      if (node.type === "image" && attachmentIdFrom(node.src)) return [];
      if (node.type === "link" && attachmentIdFrom(node.href)) return [];
      return [node.value];
    })
    .join("")
    .trim();
}

function CompactContent({
  excerpt,
  attachments,
  table,
}: {
  excerpt: string;
  attachments: CompactAttachment[];
  table?: CompactTable;
}) {
  if (!excerpt && !attachments.length && !table) return null;

  return (
    <div className="mt-2.5 space-y-2 pl-[22px]">
      {attachments.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {attachments.slice(0, 2).map((attachment) => (
            <span
              key={attachment.id}
              title={attachment.filename}
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[10px] text-muted"
            >
              <AttachmentIcon filename={attachment.filename} />
              <span className="truncate">{attachment.filename}</span>
            </span>
          ))}
          {attachments.length > 2 && (
            <span className="inline-flex items-center rounded-md border border-line bg-panel px-2 py-1 text-[10px] text-muted-2">
              +{attachments.length - 2}
            </span>
          )}
        </div>
      )}

      {excerpt && (
        <p className="clamp-2 text-[12px] leading-[1.6] text-muted">{excerpt}</p>
      )}

      {table && <CompactTablePreview table={table} />}
    </div>
  );
}

function CompactTablePreview({ table }: { table: CompactTable }) {
  const visibleHeaders = table.headers.slice(0, 3);
  const visibleRows = table.rows.slice(0, 2);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[280px] table-fixed border-collapse text-left text-[9px]">
          <thead className="bg-panel text-muted">
            <tr>
              {visibleHeaders.map((header, index) => (
                <th
                  key={index}
                  className="truncate border-b border-r border-line px-2 py-1.5 font-semibold last:border-r-0"
                >
                  {stripMarkdown(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-muted-2">
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {visibleHeaders.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className={cn(
                      "truncate border-line px-2 py-1.5",
                      columnIndex < visibleHeaders.length - 1 && "border-r",
                      rowIndex < visibleRows.length - 1 && "border-b",
                    )}
                  >
                    {stripMarkdown(row[columnIndex] ?? "") || "\u00a0"}
                  </td>
                ))}
              </tr>
            ))}
            {!visibleRows.length && (
              <tr>
                {visibleHeaders.map((_, index) => (
                  <td
                    key={index}
                    className="border-r border-line px-2 py-1.5 last:border-r-0"
                  >
                    &nbsp;
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(table.headers.length > 3 || table.rows.length > 2) && (
        <div className="border-t border-line bg-panel px-2 py-1 text-right text-[9px] text-muted-2">
          {table.rows.length} rows · {table.headers.length} columns
        </div>
      )}
    </div>
  );
}

function AttachmentIcon({ filename }: { filename: string }) {
  const extension = filename.split(".").pop()?.toLowerCase();
  const className = "size-3 shrink-0 text-glow-2";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) {
    return <FileImage className={className} />;
  }
  if (["mp4", "webm", "mov", "avi", "mkv", "mpeg"].includes(extension ?? "")) {
    return <FileVideo className={className} />;
  }
  if (["mp3", "m4a", "ogg", "wav", "flac"].includes(extension ?? "")) {
    return <FileAudio className={className} />;
  }
  if (["xls", "xlsx", "ods", "csv", "tsv"].includes(extension ?? "")) {
    return <FileSpreadsheet className={className} />;
  }
  if (["ppt", "pptx"].includes(extension ?? "")) {
    return <Presentation className={className} />;
  }
  if (["pdf", "doc", "docx", "odt", "txt", "md"].includes(extension ?? "")) {
    return <FileText className={className} />;
  }
  return <Paperclip className={className} />;
}
