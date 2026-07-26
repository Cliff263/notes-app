"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type WikiLinkTarget = { id: string; title: string } | undefined;

type PreviewProps = {
  source: string;
  /** Given, checklists become tickable; withheld, they render read-only. */
  onToggleTask?: (line: number) => void;
  /** Resolves `[[a title]]` to a note, or undefined when nothing matches. */
  resolveLink?: (title: string) => WikiLinkTarget;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (title: string) => void;
};

/** Renders the shared markdown blocks. No HTML from the note is ever injected. */
export function MarkdownPreview({
  source,
  onToggleTask,
  resolveLink,
  onOpenNote,
  onCreateNote,
}: PreviewProps) {
  const blocks = parseMarkdown(source);
  const inline = { resolveLink, onOpenNote, onCreateNote };

  if (!blocks.length) {
    return <p className="text-[13px] text-muted-2">Nothing to preview yet.</p>;
  }

  return (
    <div className="space-y-3 text-[13px] leading-[1.75]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const size =
              block.level === 1
                ? "text-[19px]"
                : block.level === 2
                  ? "text-[16px]"
                  : "text-[14px]";
            return (
              <p key={index} className={`${size} font-semibold tracking-tight`}>
                <InlineRun content={block.content} {...inline} />
              </p>
            );
          }
          case "task":
            return (
              <TaskItem
                key={index}
                checked={block.checked}
                onToggle={onToggleTask && (() => onToggleTask(block.line))}
              >
                <InlineRun content={block.content} {...inline} />
              </TaskItem>
            );
          case "bullet":
            return (
              <div key={index} className="flex gap-2 pl-1">
                <span className="shrink-0 text-muted-2">
                  {block.ordered ? block.marker : "•"}
                </span>
                <span>
                  <InlineRun content={block.content} {...inline} />
                </span>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="border-l-2 border-glow-1 pl-3 text-muted italic"
              >
                <InlineRun content={block.content} {...inline} />
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-lg border border-line bg-panel p-3 font-mono text-[12px] scroll-thin"
              >
                {block.value}
              </pre>
            );
          case "rule":
            return <hr key={index} className="border-line" />;
          default:
            return (
              <p key={index}>
                <InlineRun content={block.content} {...inline} />
              </p>
            );
        }
      })}
    </div>
  );
}

/**
 * A checkbox when the preview can write back, a glyph when it cannot — the
 * exported and shared views render the same component without a handler.
 */
function TaskItem({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  const boxClass = cn(
    "mt-[3px] flex size-[15px] shrink-0 items-center justify-center rounded border transition",
    checked
      ? "border-transparent bg-btn text-btn-foreground"
      : "border-line-strong text-transparent",
  );

  const tick = (
    <motion.span
      initial={false}
      animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
      transition={
        reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 24 }
      }
    >
      <Check className="size-2.5" strokeWidth={3.5} />
    </motion.span>
  );

  /*
   * Only the box is the control. The label is left alone because a checklist
   * item can contain a link, and a button inside a button is invalid markup.
   */
  return (
    <div className="flex gap-2 pl-1">
      {onToggle ? (
        <motion.button
          type="button"
          onClick={onToggle}
          whileTap={reduced ? undefined : { scale: 0.88 }}
          role="checkbox"
          aria-checked={checked}
          aria-label={checked ? "Mark as not done" : "Mark as done"}
          className={cn(boxClass, "cursor-pointer hover:border-foreground")}
        >
          {tick}
        </motion.button>
      ) : (
        <span className={boxClass}>{tick}</span>
      )}

      <span className={cn("min-w-0", checked && "text-muted-2 line-through")}>
        {children}
      </span>
    </div>
  );
}

function InlineRun({
  content,
  resolveLink,
  onOpenNote,
  onCreateNote,
}: {
  content: Inline[];
  resolveLink?: (title: string) => WikiLinkTarget;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (title: string) => void;
}) {
  return (
    <>
      {content.map((node, index) => {
        switch (node.type) {
          case "bold":
            return <strong key={index}>{node.value}</strong>;
          case "italic":
            return <em key={index}>{node.value}</em>;
          case "code":
            return (
              <code
                key={index}
                className="rounded bg-panel px-1 py-0.5 font-mono text-[12px] text-glow-2"
              >
                {node.value}
              </code>
            );
          case "wikilink": {
            const target = resolveLink?.(node.target);

            if (target) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onOpenNote?.(target.id)}
                  className="rounded text-glow-1 underline decoration-dotted underline-offset-4 transition hover:decoration-solid"
                >
                  {node.value}
                </button>
              );
            }

            // Nothing to point at yet, so the link offers to make it.
            return (
              <button
                key={index}
                type="button"
                onClick={() => onCreateNote?.(node.target)}
                title={`Create “${node.target}”`}
                className="inline-flex items-center gap-0.5 rounded border border-dashed border-line-strong px-1 text-muted-2 transition hover:text-foreground"
              >
                <Plus className="size-2.5" />
                {node.value}
              </button>
            );
          }
          case "link":
            return (
              <a
                key={index}
                href={node.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-glow-2 underline underline-offset-2"
              >
                {node.value}
              </a>
            );
          default:
            return <Fragment key={index}>{node.value}</Fragment>;
        }
      })}
    </>
  );
}
