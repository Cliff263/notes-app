"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FileType,
  Hash,
  Hash as HashIcon,
  MoreHorizontal,
  Pin,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type ExportFormat, type Note } from "@/lib/types";
import { useBreakpoint } from "@/lib/use-media-query";
import { cn, longDateTime, wordCount } from "@/lib/utils";
import { useNotesStore } from "@/store/notes-store";

export function NoteEditor() {
  const note = useNotesStore((state) =>
    state.notes.find((item) => item.id === state.selectedId),
  );
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
  const updateNote = useNotesStore((state) => state.updateNote);
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const duplicateNote = useNotesStore((state) => state.duplicateNote);
  const select = useNotesStore((state) => state.select);

  const [tagDraft, setTagDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
                    void duplicateNote(note.id);
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

      <div className="flex items-center gap-2 px-4 pt-2">
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
      </div>

      <p className="px-4 pt-3 text-[11px] text-muted-2">
        Updated {longDateTime(note.updatedAt)} · {wordCount(note.content)} words
      </p>

      <div className="mt-3 min-h-0 flex-1 border-t border-line">
        <textarea
          value={note.content}
          onChange={(event) => updateNote(note.id, { content: event.target.value })}
          placeholder="Start writing..."
          spellCheck={false}
          className="h-full w-full resize-none bg-transparent px-4 py-4 text-[13px] leading-[1.75] text-foreground scroll-thin"
        />
      </div>
    </motion.div>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 py-2 text-[12px] transition hover:bg-card-hover",
        indent ? "pl-7 pr-3" : "px-3",
        danger ? "text-muted hover:text-danger" : "text-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
