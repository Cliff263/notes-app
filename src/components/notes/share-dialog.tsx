"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Globe, Link2Off, X } from "lucide-react";
import { useState } from "react";
import { useShare, useShareActions } from "@/hooks/use-note-history";
import { SHARE_DURATIONS } from "@/lib/types";
import { cn, longDateTime } from "@/lib/utils";

/**
 * Publishing a note to a link anyone can open. Deliberately one link per note:
 * "shared" is a state the note is in, so revoking it is unambiguous rather than
 * a question of which of several links to withdraw.
 */
export function ShareDialog({
  noteId,
  title,
  open,
  onClose,
}: {
  noteId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const { data: share, isPending } = useShare(noteId, open);
  const { share: publish, revoke, working } = useShareActions(noteId);

  const [duration, setDuration] = useState<string>("forever");
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Globe className="size-4 text-muted-2" />
              <h2 className="flex-1 truncate text-[13px] font-semibold tracking-tight">
                Share “{title || "Untitled note"}”
              </h2>
              <button
                type="button"
                aria-label="Close share"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-muted-2 transition hover:bg-card-hover hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="space-y-3 px-4 py-4">
              {isPending ? (
                <p className="text-[12px] text-muted-2">Checking…</p>
              ) : share ? (
                <>
                  <p className="text-[12px] leading-relaxed text-muted">
                    Anyone with this link can read the note. They cannot edit it,
                    and they do not need an account.
                  </p>

                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={share.url}
                      data-share-url
                      onFocus={(event) => event.currentTarget.select()}
                      className="field-sm h-9 min-w-0 flex-1 rounded-lg border border-line bg-input px-3 text-muted"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-btn px-3 text-[12px] font-medium text-btn-foreground transition hover:opacity-90"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-2">
                    {share.expiresAt
                      ? `Stops working ${longDateTime(share.expiresAt)}`
                      : "No expiry set."}
                  </p>

                  <button
                    type="button"
                    onClick={revoke}
                    disabled={working}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:text-danger disabled:opacity-50"
                  >
                    <Link2Off className="size-3.5" />
                    Stop sharing
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed text-muted">
                    Create a link that anyone can open to read this note. It stays
                    read-only, and you can withdraw it at any time.
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {SHARE_DURATIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDuration(option.value)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] transition",
                          duration === option.value
                            ? "border-transparent bg-btn text-btn-foreground"
                            : "border-line text-muted hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => publish(duration)}
                    disabled={working}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-btn px-3 text-[12px] font-medium text-btn-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Globe className="size-3.5" />
                    Create link
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
