"use client";

import { Eye, PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Presence } from "@/components/notes/presence";
import { useCollab } from "@/hooks/use-collab";
import { api } from "@/lib/api";
import { cn, wordCount } from "@/lib/utils";

const MarkdownPreview = dynamic(
  () => import("./markdown-preview").then((m) => m.MarkdownPreview),
  { ssr: false, loading: () => <p className="text-[13px] text-muted-2">Rendering…</p> },
);

type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * The editor a guest gets on a note shared with editing enabled.
 *
 * Two independent things are happening. Live sync is peer to peer, so edits
 * appear as they are typed — and if that connection cannot be made, nothing
 * here stops working, because saving is a plain request to the share's own
 * endpoint. Collaboration is the nice part; durability is the part that has to
 * hold.
 */
export function SharedEditor({
  token,
  initialTitle,
  initialContent,
}: {
  token: string;
  initialTitle: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Someone else's edit: take the new text, and move our caret with it. */
  const onRemoteText = useCallback(
    (next: string, moveCaret: (caret: number) => number) => {
      const field = textareaRef.current;
      const caret = field ? moveCaret(field.selectionStart) : 0;

      setContent(next);

      if (field && document.activeElement === field) {
        requestAnimationFrame(() => field.setSelectionRange(caret, caret));
      }
    },
    [],
  );

  const { status, peers, publish } = useCollab({
    token,
    name: "Guest",
    onRemoteText,
  });

  useEffect(() => {
    const timer = saveTimer.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  function save(next: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await api(`/api/s/${token}`, {
          method: "PATCH",
          body: JSON.stringify({ content: next }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    }, 700);
  }

  function edit(next: string) {
    setContent(next);
    publish(next);
    save(next);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <Presence status={status} peers={peers} />
          <span className="text-[11px] text-muted-2">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "failed" && (
              <span className="text-danger">Could not save — check the link</span>
            )}
            {saveState === "idle" && `${wordCount(content)} words`}
          </span>
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

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => edit(event.target.value)}
          placeholder="Start writing… markdown works here"
          spellCheck={false}
          aria-label={`Editing ${initialTitle || "a shared note"}`}
          className="field min-h-[52vh] w-full resize-none bg-transparent py-5 leading-[1.75] text-foreground outline-none scroll-thin"
        />
      ) : (
        <div className="py-5">
          <MarkdownPreview source={content} shareToken={token} />
        </div>
      )}
    </section>
  );
}
