"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Bold,
  Braces,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  CornerUpLeft,
  Download,
  Eye,
  FileText,
  FileType,
  Globe,
  Hash,
  Hash as HashIcon,
  Heading2,
  History,
  Italic,
  Mail,
  MessageCircle,
  Paperclip,
  Link as LinkIcon,
  List as ListIcon,
  ListChecks,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  PenLine,
  Pin,
  Printer,
  Quote,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ALLOWED_MIME, attachmentMarkdown, isImageMime } from "@/lib/attachments";
import { continuationFor, toggleTask, wikiLinkQueryAt } from "@/lib/markdown";
import { ROUTES } from "@/lib/routes";
import { CATEGORIES, type ExportFormat, type Note } from "@/lib/types";
import { useBreakpoint } from "@/lib/use-media-query";
import {
  cn,
  EVENT_COLOR_VALUES,
  longDateTime,
  readingTime,
  shortDate,
  stripMarkdown,
  timeLabel,
  toLocalInputValue,
  wordCount,
} from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion";
import { useEvents, useEventActions } from "@/hooks/use-events";
import { useCollab } from "@/hooks/use-collab";
import { useBacklinks, useNoteTitles } from "@/hooks/use-note-links";
import {
  useShare,
  useShareActions,
  type Share,
} from "@/hooks/use-note-history";
import {
  SHARE_FILE_FORMATS,
  shareNoteFile,
  type ShareFileFormat,
} from "@/lib/share-targets";
import { Presence } from "./presence";
import { useNote, useNoteActions, useNoteAutosave } from "@/hooks/use-notes";
const MarkdownPreview = dynamic(
  () => import("./markdown-preview").then((m) => m.MarkdownPreview),
  {
    ssr: false,
    loading: () => <p className="text-[13px] text-muted-2">Rendering…</p>,
  },
);
// Neither of these belongs in the first paint: one carries a diff algorithm,
// the other is only reached from a menu.
const HistorySheet = dynamic(
  () => import("./history-sheet").then((m) => m.HistorySheet),
  { ssr: false },
);
const ShareDialog = dynamic(() => import("./share-dialog").then((m) => m.ShareDialog), {
  ssr: false,
});
const PrintPreview = dynamic(
  () => import("./print-preview").then((m) => m.PrintPreview),
  { ssr: false },
);
import { useNotesStore } from "@/store/notes-store";

export function NoteEditor() {
  const selectedId = useNotesStore((state) => state.selectedId);
  const note = useNote(selectedId);
  const { isDesktop } = useBreakpoint();

  /*
   * One editor, in one place: the pane on desktop, a sheet below lg. Picking
   * here rather than hiding one with CSS keeps a single textarea in the DOM,
   * so assistive tech and autofocus never see two copies of the same note.
   */
  if (!isDesktop) {
    return (
      <AnimatePresence>
        {note && (
          <motion.section
            key={note.id}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-0 z-40 flex flex-col bg-surface"
          >
            <EditorBody note={note} sheet />
          </motion.section>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <section className="hidden h-full w-[46%] min-w-[380px] shrink-0 flex-col bg-surface lg:flex">
        <AnimatePresence mode="wait">
          {note ? (
            <EditorBody key={note.id} note={note} />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center"
            >
              <p className="text-[13px] font-medium">No note selected</p>
              <p className="max-w-[280px] text-[12px] text-muted-2">
                Pick a note from the list to read it, or create a new one to start
                writing.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </>
  );
}

function EditorBody({ note, sheet }: { note: Note; sheet?: boolean }) {
  const { createNote, deleteNote, duplicateNote } = useNoteActions();
  const updateNote = useNoteAutosave();
  const select = useNotesStore((state) => state.select);

  /*
   * The body is held here rather than read back from the cache on every
   * keystroke. `note` arrives as a prop, so any local state change re-renders
   * this component with whatever the parent last passed down — which, mid-word,
   * is the text as it was before the last character. Owning the draft keeps the
   * textarea in step with the keyboard; the cache is still written on every
   * change, so the card list and the word count follow along.
   *
   * The component is keyed by note id, so switching notes starts a fresh draft.
   */
  const [content, setContent] = useState(note.content);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function writeContent(next: string) {
    setContent(next);
    updateNote(note.id, { content: next });
    // A no-op unless this note is in a room with someone. `collab` is declared
    // below; this is a hoisted function declaration, so it only reads it when
    // called, which is always after that point.
    collab.publish(next);
  }

  const [tagDraft, setTagDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [scheduling, setScheduling] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [preparedShare, setPreparedShare] = useState<Share | null>(null);
  const [sharePreparing, setSharePreparing] = useState(false);
  const [shareFileFormat, setShareFileFormat] =
    useState<ShareFileFormat>("pdf");
  const [fileSharing, setFileSharing] = useState<"email" | "whatsapp" | null>(
    null,
  );
  const [shareFileMessage, setShareFileMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // `[[` link completion: what is being typed, and which suggestion is active.
  const [linkMenu, setLinkMenu] = useState<{ query: string; start: number } | null>(null);
  const [linkCursor, setLinkCursor] = useState(0);

  const { titles, byTitle } = useNoteTitles();
  const { data: backlinks = [] } = useBacklinks(note.id, Boolean(note.title.trim()));

  /*
   * Whether this note is shared, and on what terms. Two small columns, cached
   * for a minute — the cost of knowing whether to open a peer connection.
   */
  const {
    data: share,
    isPending: sharePending,
    refetch: refetchShare,
  } = useShare(note.id, true);
  const { createShare } = useShareActions(note.id);
  const shareCreation = useRef<Promise<Share> | null>(null);
  const activeShare = share ?? preparedShare;

  /** Someone else's edit: take their text, and carry our caret across it. */
  const onRemoteText = useCallback(
    (next: string, moveCaret: (caret: number) => number) => {
      const field = textareaRef.current;
      const caret = field ? moveCaret(field.selectionStart) : 0;

      setContent(next);
      // The cache follows too, so the card list and the counts stay honest.
      updateNote(note.id, { content: next }, 0);

      if (field && document.activeElement === field) {
        requestAnimationFrame(() => field.setSelectionRange(caret, caret));
      }
    },
    [note.id, updateNote],
  );

  const collab = useCollab({
    // Only a link that grants editing opens a room at all.
    token: share?.allowEdit ? share.token : null,
    name: "Owner",
    seed: content,
    onRemoteText,
  });


  const suggestions = (() => {
    if (!linkMenu) return [];
    const needle = linkMenu.query.trim().toLowerCase();
    return titles
      .filter(
        (candidate) =>
          candidate.id !== note.id &&
          (!needle || candidate.title.toLowerCase().includes(needle)),
      )
      .slice(0, 6);
  })();

  const { createEvent } = useEventActions();
  // The editor needs events to show what this note is already linked to;
  // React Query dedupes this with the calendar page's own query.
  const { data: events = [] } = useEvents(Boolean(note.dueAt));

  const linkedEvents = events.filter((event) => event.noteId === note.id);
  const scheduled = linkedEvents.length > 0;
  const dueLocal = note.dueAt ? toLocalInputValue(note.dueAt) : "";
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openShareSetup() {
    setMenuOpen(false);
    setShareOpen(true);
  }

  async function copyShareLink() {
    setSharePreparing(true);
    try {
      const target = await getShareTarget();
      setPreparedShare(target);
      await navigator.clipboard.writeText(target.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    } catch {
      openShareSetup();
    } finally {
      setSharePreparing(false);
    }
  }

  async function getShareTarget() {
    if (activeShare) return activeShare;

    // Do not replace a link just because its initial lookup was still in
    // flight when the user opened the menu.
    if (sharePending) {
      const existing = await refetchShare();
      if (existing.data) return existing.data;
    }

    if (!shareCreation.current) {
      shareCreation.current = createShare("forever", false).finally(() => {
        shareCreation.current = null;
      });
    }
    return shareCreation.current;
  }

  async function shareFile(target: "email" | "whatsapp") {
    setFileSharing(target);
    setShareFileMessage(null);
    try {
      const result = await shareNoteFile(note.id, note.title, shareFileFormat);
      if (result === "shared") {
        setMenuOpen(false);
        setShareMenuOpen(false);
      } else if (result === "downloaded") {
        setShareFileMessage("File downloaded because native sharing is unavailable.");
      }
    } catch {
      setShareFileMessage("Could not prepare the file.");
    } finally {
      setFileSharing(null);
    }
  }

  function openPrintPreview() {
    setMenuOpen(false);
    setShareOpen(false);
    setPrintOpen(true);
  }

  /** Wraps the selection, or drops the markers in place for typing between. */
  function wrapSelection(before: string, after: string) {
    const field = textareaRef.current;
    if (!field) return;

    const { selectionStart: start, selectionEnd: end, value } = field;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;

    writeContent(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  /** Adds (or removes) a line prefix on every line the selection touches. */
  function prefixLine(prefix: string) {
    const field = textareaRef.current;
    if (!field) return;

    const { selectionStart: start, selectionEnd: end, value } = field;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);

    const block = value.slice(lineStart, lineEnd);
    const already = block.split("\n").every((line) => line.startsWith(prefix));
    const updated = block
      .split("\n")
      .map((line) => (already ? line.slice(prefix.length) : `${prefix}${line}`))
      .join("\n");

    writeContent(`${value.slice(0, lineStart)}${updated}${value.slice(lineEnd)}`);
    requestAnimationFrame(() => field.focus());
  }

  /**
   * Uploads a dropped, pasted or chosen file and drops the markdown for it in
   * at the caret. Files go to the note they were dropped on, so deleting the
   * note takes its attachments with it.
   */
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);

    const field = textareaRef.current;
    let next = field?.value ?? content;
    let caret = field?.selectionStart ?? next.length;

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);

      try {
        const uploaded = await api<{ id: string; filename: string; mime: string }>(
          `/api/notes/${note.id}/attachments`,
          { method: "POST", body: form },
        );

        // A picture wants a line of its own; a file can sit in the sentence.
        const snippet = attachmentMarkdown(uploaded);
        const insert = isImageMime(uploaded.mime) ? `\n${snippet}\n` : snippet;

        next = `${next.slice(0, caret)}${insert}${next.slice(caret)}`;
        caret += insert.length;
      } catch (error) {
        setUploadError(
          error instanceof ApiError ? error.message : "That file could not be attached",
        );
      }
    }

    writeContent(next);
    setUploading(false);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(caret, caret);
    });
  }

  /** Opens or closes the link menu based on where the caret is now. */
  function syncLinkMenu(field: HTMLTextAreaElement) {
    const found = wikiLinkQueryAt(field.value, field.selectionStart);

    // Only a real change is worth a render — this runs on every keystroke.
    setLinkMenu((current) => {
      if (!found && !current) return current;
      if (found && current && found.query === current.query && found.start === current.start) {
        return current;
      }
      return found;
    });
    setLinkCursor(0);
  }

  /** Replaces the half-typed `[[…` with a finished link to `title`. */
  function completeLink(title: string) {
    const field = textareaRef.current;
    if (!field || !linkMenu) return;

    const { value, selectionStart: caret } = field;
    const next = `${value.slice(0, linkMenu.start)}[[${title}]]${value.slice(caret)}`;
    const caretAfter = linkMenu.start + title.length + 4;

    writeContent(next);
    setLinkMenu(null);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(caretAfter, caretAfter);
    });
  }

  /** Enter inside a list continues it; Enter on an empty item ends it. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // The link menu takes the arrow keys and Enter while it is open.
    if (linkMenu && suggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLinkCursor((value) => Math.min(value + 1, suggestions.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLinkCursor((value) => Math.max(value - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        completeLink(suggestions[Math.min(linkCursor, suggestions.length - 1)].title);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setLinkMenu(null);
        return;
      }
    }

    if (event.key !== "Enter" || event.shiftKey) return;

    const field = event.currentTarget;
    const { selectionStart: caret, value } = field;
    const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
    const line = value.slice(lineStart, caret);

    const continuation = continuationFor(line);
    if (continuation === null) return;

    event.preventDefault();
    const next =
      continuation === ""
        ? `${value.slice(0, lineStart)}\n${value.slice(caret)}`
        : `${value.slice(0, caret)}\n${continuation}${value.slice(caret)}`;
    const caretAfter =
      continuation === "" ? lineStart + 1 : caret + 1 + continuation.length;

    writeContent(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(caretAfter, caretAfter);
    });
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  /**
   * Exports go through a normal navigation so the browser handles the download
   * dialog; the route answers with a Content-Disposition attachment.
   */
  function exportNote(format: ExportFormat) {
    setMenuOpen(false);
    setExportOpen(false);
    window.location.href = `/api/notes/${note.id}/export?format=${format}`;
  }

  /** Creates an hour-long event from the note, linked both ways. */
  async function addToCalendar() {
    setScheduling(true);
    const start = note.dueAt ? new Date(note.dueAt) : new Date();
    if (!note.dueAt) start.setHours(start.getHours() + 1, 0, 0, 0);

    const ok = await createEvent({
      title: note.title || "Untitled note",
      description: stripMarkdown(content).slice(0, 240),
      location: "",
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
      allDay: false,
      color: "violet",
      noteId: note.id,
    });

    if (ok && !note.dueAt) updateNote(note.id, { dueAt: start.toISOString() });
    setScheduling(false);
  }

  function updateDueDate(date: string) {
    if (!date) {
      updateNote(note.id, { dueAt: null });
      return;
    }
    const time = dueLocal.slice(11, 16) || "09:00";
    updateNote(note.id, { dueAt: new Date(`${date}T${time}`).toISOString() });
  }

  function updateDueTime(time: string) {
    const date = dueLocal.slice(0, 10);
    if (!date || !time) return;
    updateNote(note.id, { dueAt: new Date(`${date}T${time}`).toISOString() });
  }

  function addTag() {
    const tag = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (!tag || note.tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    updateNote(note.id, { tags: [...note.tags, tag] });
    setTagDraft("");
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full flex-col"
    >
      <div className={cn("flex items-center gap-2 px-4 pt-3", sheet && "safe-top")}>
        {sheet && (
          <button
            type="button"
            aria-label="Back to list"
            onClick={() => select(null)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <input
          value={note.title}
          onChange={(event) => updateNote(note.id, { title: event.target.value })}
          placeholder="Untitled note"
          className="field h-9 min-w-0 flex-1 rounded-lg border border-line bg-input px-3 font-medium transition focus:border-line-strong"
        />

        <IconAction
          label={note.pinned ? "Unpin" : "Pin"}
          active={note.pinned}
          onClick={() => updateNote(note.id, { pinned: !note.pinned })}
        >
          <Pin className={cn("size-4", note.pinned && "fill-current")} />
        </IconAction>

        <IconAction
          label={note.favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => updateNote(note.id, { favorite: !note.favorite })}
          className={note.favorite ? "text-accent hover:text-accent" : undefined}
        >
          <Star className={cn("size-4", note.favorite && "fill-accent")} />
        </IconAction>

        <div className="relative" ref={menuRef}>
          <IconAction label="More actions" onClick={() => setMenuOpen((open) => !open)}>
            <MoreHorizontal className="size-4" />
          </IconAction>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-lg border border-line bg-card shadow-xl"
              >
                <MenuItem
                  icon={Copy}
                  label="Duplicate"
                  onClick={() => {
                    setMenuOpen(false);
                    duplicateNote(note);
                  }}
                />

                <button
                  type="button"
                  onClick={() => setExportOpen((open) => !open)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
                >
                  <Download className="size-3.5" />
                  <span className="flex-1 text-left">Export</span>
                  <ChevronRight
                    className={cn("size-3 transition", exportOpen && "rotate-90")}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {exportOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="overflow-hidden border-y border-line bg-panel"
                    >
                      <MenuItem
                        icon={FileType}
                        label="PDF document"
                        indent
                        onClick={() => exportNote("pdf")}
                      />
                      <MenuItem
                        icon={FileText}
                        label="Word (.docx)"
                        indent
                        onClick={() => exportNote("docx")}
                      />
                      <MenuItem
                        icon={HashIcon}
                        label="Markdown (.md)"
                        indent
                        onClick={() => exportNote("md")}
                      />
                      <MenuItem
                        icon={FileText}
                        label="Plain text (.txt)"
                        indent
                        onClick={() => exportNote("txt")}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setShareMenuOpen((open) => !open);
                  }}
                  aria-expanded={shareMenuOpen}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
                >
                  <Share2 className="size-3.5" />
                  <span className="flex-1 text-left">Share</span>
                  <ChevronRight
                    className={cn("size-3 transition", shareMenuOpen && "rotate-90")}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {shareMenuOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="overflow-hidden border-y border-line bg-panel"
                    >
                      {sharePreparing && (
                        <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-2">
                          <Loader2 className="size-3.5 animate-spin" />
                          Preparing secure link…
                        </p>
                      )}
                      <MenuItem
                        icon={shareCopied ? Check : LinkIcon}
                        label={shareCopied ? "Link copied" : "Copy link"}
                        indent
                        disabled={sharePreparing}
                        onClick={() => void copyShareLink()}
                      />
                      <div className="flex items-center gap-1 px-3 py-1.5 pl-7">
                        {SHARE_FILE_FORMATS.map((format) => (
                          <button
                            key={format.value}
                            type="button"
                            onClick={() => setShareFileFormat(format.value)}
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[9px] transition",
                              shareFileFormat === format.value
                                ? "border-transparent bg-btn text-btn-foreground"
                                : "border-line text-muted-2 hover:text-foreground",
                            )}
                          >
                            {format.label}
                          </button>
                        ))}
                      </div>
                      <MenuItem
                        icon={fileSharing === "whatsapp" ? Loader2 : MessageCircle}
                        label={
                          fileSharing === "whatsapp"
                            ? "Preparing file…"
                            : "WhatsApp"
                        }
                        indent
                        disabled={fileSharing !== null}
                        onClick={() => void shareFile("whatsapp")}
                      />
                      <MenuItem
                        icon={fileSharing === "email" ? Loader2 : Mail}
                        label={
                          fileSharing === "email" ? "Preparing file…" : "Email"
                        }
                        indent
                        disabled={fileSharing !== null}
                        onClick={() => void shareFile("email")}
                      />
                      {shareFileMessage && (
                        <p
                          role="status"
                          className="px-3 py-1.5 pl-7 text-[10px] leading-relaxed text-muted-2"
                        >
                          {shareFileMessage}
                        </p>
                      )}
                      <MenuItem
                        icon={Printer}
                        label="Print preview"
                        indent
                        onClick={openPrintPreview}
                      />
                      {activeShare && (
                        <MenuItem
                          icon={Globe}
                          label="Manage link"
                          indent
                          onClick={openShareSetup}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <MenuItem
                  icon={History}
                  label="Version history"
                  onClick={() => {
                    setMenuOpen(false);
                    setHistoryOpen(true);
                  }}
                />

                <MenuItem
                  icon={note.archived ? ArchiveRestore : Archive}
                  label={note.archived ? "Restore from archive" : "Archive"}
                  onClick={() => {
                    setMenuOpen(false);
                    updateNote(note.id, {
                      archived: !note.archived,
                      category: note.archived ? "Personal" : "Archive",
                    });
                  }}
                />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    setMenuOpen(false);
                    void deleteNote(note.id);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!sheet && (
          <IconAction label="Close note" onClick={() => select(null)}>
            <X className="size-4" />
          </IconAction>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <select
          value={note.category}
          onChange={(event) =>
            updateNote(note.id, {
              category: event.target.value,
              archived: event.target.value === "Archive",
            })
          }
          className="h-7 rounded-md border border-line field-sm bg-input px-2 text-muted transition hover:text-foreground"
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        {note.tags.map((tag) => (
          <motion.span
            key={tag}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-[11px] text-muted"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() =>
                updateNote(note.id, {
                  tags: note.tags.filter((item) => item !== tag),
                })
              }
              className="text-muted-2 transition hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </motion.span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-2">
        <Hash className="size-3.5 text-muted-2" />
        <input
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder="Add tag..."
          className="h-7 w-40 rounded-md border border-line field-sm bg-input px-2 transition focus:border-line-strong"
        />

        {/* Due date, which also puts the note on the calendar */}
        <div className="flex items-center gap-1.5 rounded-md border border-line bg-input px-2 py-1 text-[11px] text-muted-2">
          <CalendarClock className="size-3.5" />
          <input
            type="date"
            aria-label="Due date"
            value={dueLocal.slice(0, 10)}
            onChange={(event) => updateDueDate(event.target.value)}
            className="field-sm bg-transparent text-muted outline-none"
          />
          <span aria-hidden className="text-muted-2">
            ·
          </span>
          <input
            type="time"
            aria-label="Due time"
            value={dueLocal.slice(11, 16)}
            disabled={!note.dueAt}
            onChange={(event) => updateDueTime(event.target.value)}
            className="field-sm w-[72px] bg-transparent text-muted outline-none disabled:opacity-40"
          />
          {note.dueAt && (
            <button
              type="button"
              aria-label="Clear due date"
              onClick={() => updateNote(note.id, { dueAt: null })}
              className="text-muted-2 transition hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={addToCalendar}
          disabled={scheduling}
          className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] text-muted transition hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          <CalendarPlus className="size-3.5" />
          {scheduled ? "Added to calendar" : "Add to calendar"}
        </button>
      </div>

      {linkedEvents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          {linkedEvents.map((event) => (
            <Link
              key={event.id}
              href={ROUTES.calendar}
              className="flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-[11px] text-muted transition hover:text-foreground"
            >
              <span
                className="event-dot size-1.5 rounded-full"
                style={{
                  background: EVENT_COLOR_VALUES[event.color],
                  color: EVENT_COLOR_VALUES[event.color],
                }}
              />
              {shortDate(event.startsAt)} at {timeLabel(event.startsAt)} · {event.title}
            </Link>
          ))}
        </div>
      )}

      {/* What points here. Links are written by title, so this is the only way
          to see the other half of the relationship. */}
      {backlinks.length > 0 && (
        <Stagger className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          <span className="text-[11px] text-muted-2">Linked from</span>
          {backlinks.map((backlink) => (
            <StaggerItem key={backlink.id}>
              <button
                type="button"
                onClick={() => select(backlink.id)}
                className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-[11px] text-muted transition hover:text-foreground"
              >
                <CornerUpLeft className="size-3 shrink-0 text-muted-2" />
                <span className="truncate">{backlink.title || "Untitled note"}</span>
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[11px] text-muted-2">
            Updated {longDateTime(note.updatedAt)} · {wordCount(content)} words ·{" "}
            {readingTime(content)} min read
          </p>
          <Presence status={collab.status} peers={collab.peers} />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
          {(["write", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] capitalize transition",
                mode === value
                  ? "bg-card text-foreground"
                  : "text-muted-2 hover:text-foreground",
              )}
            >
              {value === "write" ? (
                <PenLine className="size-3" />
              ) : (
                <Eye className="size-3" />
              )}
              {value}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-0.5 border-t border-line px-3 pt-2">
          <FormatButton label="Bold" onClick={() => wrapSelection("**", "**")}>
            <Bold className="size-3.5" />
          </FormatButton>
          <FormatButton label="Italic" onClick={() => wrapSelection("*", "*")}>
            <Italic className="size-3.5" />
          </FormatButton>
          <FormatButton label="Heading" onClick={() => prefixLine("## ")}>
            <Heading2 className="size-3.5" />
          </FormatButton>
          <FormatButton label="Bulleted list" onClick={() => prefixLine("- ")}>
            <ListIcon className="size-3.5" />
          </FormatButton>
          <FormatButton label="Numbered list" onClick={() => prefixLine("1. ")}>
            <ListOrdered className="size-3.5" />
          </FormatButton>
          <FormatButton label="Quote" onClick={() => prefixLine("> ")}>
            <Quote className="size-3.5" />
          </FormatButton>
          <FormatButton label="Code" onClick={() => wrapSelection("`", "`")}>
            <Code className="size-3.5" />
          </FormatButton>
          <FormatButton
            label={uploading ? "Attaching…" : "Attach a file"}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className={cn("size-3.5", uploading && "animate-pulse")} />
          </FormatButton>
          <FormatButton label="Checklist" onClick={() => prefixLine("- [ ] ")}>
            <ListChecks className="size-3.5" />
          </FormatButton>
          <FormatButton label="Link" onClick={() => wrapSelection("[", "](url)")}>
            <LinkIcon className="size-3.5" />
          </FormatButton>
          <FormatButton
            label="Link to note"
            onClick={() => {
              wrapSelection("[[", "]]");
              // Opening the brackets is also how the completion menu is asked for.
              requestAnimationFrame(() => {
                const field = textareaRef.current;
                if (field) syncLinkMenu(field);
              });
            }}
          >
            <Braces className="size-3.5" />
          </FormatButton>
        </div>
      )}

      <div className="relative min-h-0 flex-1 border-t border-line">
        {mode === "write" ? (
          <>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => {
                writeContent(event.target.value);
                syncLinkMenu(event.currentTarget);
              }}
              onKeyUp={(event) => syncLinkMenu(event.currentTarget)}
              onClick={(event) => syncLinkMenu(event.currentTarget)}
              onBlur={() => setLinkMenu(null)}
              onKeyDown={handleKeyDown}
              /*
               * Pasting a screenshot and dropping a file are the two ways
               * anyone actually attaches anything; the toolbar button is the
               * fallback for a keyboard.
               */
              onPaste={(event) => {
                const files = [...event.clipboardData.files];
                if (!files.length) return;
                event.preventDefault();
                void uploadFiles(files);
              }}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) event.preventDefault();
              }}
              onDrop={(event) => {
                const files = [...event.dataTransfer.files];
                if (!files.length) return;
                event.preventDefault();
                void uploadFiles(files);
              }}
              placeholder="Start writing... markdown works here"
              spellCheck={false}
              className="field h-full w-full resize-none bg-transparent px-4 py-4 leading-[1.75] text-foreground scroll-thin"
            />

            {/*
              Anchored to the pane rather than the caret: no measuring, and it
              lands somewhere sensible on the phone sheet too.
            */}
            <AnimatePresence>
              {linkMenu && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-xl border border-line bg-card shadow-2xl"
                >
                  <p className="border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-2">
                    Link to note
                  </p>
                  {suggestions.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      type="button"
                      // The textarea blurs before a click lands, so complete on
                      // pointer-down while the menu still knows where it is.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        completeLink(candidate.title);
                      }}
                      onMouseEnter={() => setLinkCursor(index)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition",
                        index === Math.min(linkCursor, suggestions.length - 1)
                          ? "bg-card-hover text-foreground"
                          : "text-muted hover:bg-card-hover",
                      )}
                    >
                      <LinkIcon className="size-3 shrink-0 text-muted-2" />
                      <span className="min-w-0 flex-1 truncate">
                        {candidate.title || "Untitled note"}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="h-full overflow-y-auto px-4 py-4 scroll-thin">
            <MarkdownPreview
              source={content}
              onToggleTask={(line) =>
                writeContent(toggleTask(content, line))
              }
              resolveLink={(title) => byTitle.get(title.trim().toLowerCase())}
              onOpenNote={select}
              onCreateNote={(title) => void createNote(note.category, [], title)}
            />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={Object.keys(ALLOWED_MIME).join(",")}
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void uploadFiles(files);
        }}
      />

      <AnimatePresence>
        {uploadError && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setUploadError(null)}
            className="mx-4 mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-left text-[11px] text-danger"
          >
            {uploadError} — tap to dismiss
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mounted only once asked for, so neither ships in the first paint. */}
      {historyOpen && (
        <HistorySheet
          noteId={note.id}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={(version) => {
            setContent(version.content);
            updateNote(note.id, { title: version.title, content: version.content }, 0);
            setHistoryOpen(false);
          }}
        />
      )}

      {shareOpen && (
        <ShareDialog
          noteId={note.id}
          title={note.title}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onPrint={openPrintPreview}
        />
      )}

      {printOpen && (
        <PrintPreview
          note={note}
          content={content}
          open={printOpen}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </motion.div>
  );
}

function FormatButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-muted-2 transition hover:bg-card-hover hover:text-foreground"
    >
      {children}
    </button>
  );
}

function IconAction({
  label,
  onClick,
  active,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-card-hover hover:text-foreground",
        active ? "text-foreground" : "text-muted-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
  indent,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  indent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 py-2 text-[12px] transition hover:bg-card-hover disabled:pointer-events-none disabled:opacity-40",
        indent ? "pl-7 pr-3" : "px-3",
        danger ? "text-muted hover:text-danger" : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
