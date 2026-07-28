import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownPreview } from "@/components/notes/markdown-preview";
import { SharedEditor } from "@/components/notes/shared-editor";
import { resolveShare } from "@/lib/share";
import { longDateTime, readingTime, stripMarkdown, wordCount } from "@/lib/utils";

type Params = { params: Promise<{ token: string }> };

/**
 * A note as a page anyone can open. No session, no navigation into the rest of
 * the workspace, and no way in from here — a link grants exactly one note.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const found = await resolveShare(token);

  if (!found) return { title: "Note not found", robots: { index: false } };

  return {
    title: found.note.title || "Untitled note",
    description: stripMarkdown(found.note.content).slice(0, 160),
    // A capability URL should not end up in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function SharedNotePage({ params }: Params) {
  const { token } = await params;
  const found = await resolveShare(token);

  if (!found) notFound();

  const { note } = found;

  return (
    <main className="print-note mx-auto min-h-dvh w-full max-w-[760px] px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-line pb-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-2">
          {found.share.allowEdit ? "Shared note · you can edit this" : "Shared note"}
        </p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
          {note.title || "Untitled note"}
        </h1>
        <p className="mt-2 text-[12px] text-muted-2">
          {note.category} · Updated {longDateTime(note.updatedAt)} ·{" "}
          {wordCount(note.content)} words · {readingTime(note.content)} min read
        </p>

        {note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-muted-2"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {found.share.allowEdit ? (
        <div className="py-5">
          <SharedEditor
            token={token}
            initialTitle={note.title}
            initialContent={note.content}
          />
        </div>
      ) : (
        <article className="py-7">
          {/* Read-only: no toggle handler, so the checkboxes render as glyphs. */}
          <MarkdownPreview source={note.content} shareToken={token} />
        </article>
      )}

      <footer
        data-print-hidden
        className="border-t border-line pt-5 text-[11px] leading-relaxed text-muted-2"
      >
        Shared from{" "}
        <Link href="/" className="text-glow-2 underline underline-offset-2">
          Nexora
        </Link>
        . The owner can withdraw this link at any time.
        {found.share.allowEdit &&
          " Your changes are saved to their workspace and kept in the note's history."}
      </footer>
    </main>
  );
}
