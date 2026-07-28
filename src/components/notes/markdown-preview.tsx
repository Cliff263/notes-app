"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Columns3, Download, Plus, Rows3, X } from "lucide-react";
import { Fragment } from "react";
import { attachmentIdFrom } from "@/lib/attachments";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { tableToCsv } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { AttachmentCard } from "./attachment-card";

export type WikiLinkTarget = { id: string; title: string } | undefined;

type PreviewProps = {
  source: string;
  /** Given, checklists become tickable; withheld, they render read-only. */
  onToggleTask?: (line: number) => void;
  /** Resolves `[[a title]]` to a note, or undefined when nothing matches. */
  resolveLink?: (title: string) => WikiLinkTarget;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (title: string) => void;
  /** Given, tables expose spreadsheet-style cell and shape controls. */
  onChangeTable?: (
    line: number,
    previousRows: number,
    headers: string[],
    rows: string[][],
  ) => void;
  /**
   * On a publicly shared note the reader has no session, so the token is what
   * entitles them to the images the note embeds.
   */
  shareToken?: string;
};

/** Renders the shared markdown blocks. No HTML from the note is ever injected. */
export function MarkdownPreview({
  source,
  onToggleTask,
  resolveLink,
  onOpenNote,
  onCreateNote,
  onChangeTable,
  shareToken,
}: PreviewProps) {
  const blocks = parseMarkdown(source);
  const inline = { resolveLink, onOpenNote, onCreateNote, shareToken };

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
          case "table":
            return (
              <EditableTable
                key={index}
                headers={block.headers}
                rows={block.rows}
                editable={Boolean(onChangeTable)}
                onChange={(headers, rows) =>
                  onChangeTable?.(block.line, block.rows.length, headers, rows)
                }
                inline={inline}
              />
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

function EditableTable({
  headers,
  rows,
  editable,
  onChange,
  inline,
}: {
  headers: string[];
  rows: string[][];
  editable: boolean;
  onChange: (headers: string[], rows: string[][]) => void;
  inline: Omit<Parameters<typeof InlineRun>[0], "content">;
}) {
  const patchCell = (row: number, column: number, value: string) => {
    if (row === -1) {
      onChange(headers.map((cell, index) => (index === column ? value : cell)), rows);
      return;
    }
    onChange(
      headers,
      rows.map((cells, index) =>
        index === row
          ? cells.map((cell, cellIndex) => (cellIndex === column ? value : cell))
          : cells,
      ),
    );
  };

  const cell = (value: string, row: number, column: number, heading = false) =>
    editable ? (
      <input
        aria-label={`${heading ? "Header" : `Row ${row + 1}`} column ${column + 1}`}
        value={value}
        onChange={(event) => patchCell(row, column, event.target.value)}
        className="field-sm min-w-[120px] w-full bg-transparent px-2.5 py-2 text-foreground"
      />
    ) : (
      <span className="block min-w-[100px] px-2.5 py-2">
        <InlineRun content={parseMarkdownCell(value)} {...inline} />
      </span>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="bg-panel font-semibold">
            <tr>
              {headers.map((value, column) => (
                <th key={column} className="border-b border-r border-line last:border-r-0">
                  {cell(value, -1, column, true)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, row) => (
              <tr key={row} className="even:bg-panel/40">
                {headers.map((_, column) => (
                  <td key={column} className="border-b border-r border-line last:border-r-0">
                    {cell(cells[column] ?? "", row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line bg-panel px-2 py-1.5">
          <TableControl
            label="Add row"
            icon={Rows3}
            onClick={() => onChange(headers, [...rows, headers.map(() => "")])}
          />
          <TableControl
            label="Add column"
            icon={Columns3}
            onClick={() =>
              onChange(
                [...headers, `Column ${headers.length + 1}`],
                rows.map((row) => [...row, ""]),
              )
            }
          />
          {rows.length > 1 && (
            <TableControl
              label="Remove last row"
              icon={X}
              onClick={() => onChange(headers, rows.slice(0, -1))}
            />
          )}
          {headers.length > 1 && (
            <TableControl
              label="Remove last column"
              icon={X}
              onClick={() =>
                onChange(
                  headers.slice(0, -1),
                  rows.map((row) => row.slice(0, -1)),
                )
              }
            />
          )}
          <span className="min-w-2 flex-1" />
          <TableControl
            label="Download CSV"
            icon={Download}
            onClick={() => downloadTable(headers, rows)}
          />
        </div>
      )}
    </div>
  );
}

function downloadTable(headers: string[], rows: string[][]) {
  const url = URL.createObjectURL(
    new Blob([tableToCsv(headers, rows)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "note-table.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseMarkdownCell(value: string) {
  const [block] = parseMarkdown(value);
  return block && "content" in block
    ? block.content
    : [{ type: "text" as const, value }];
}

function TableControl({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted transition hover:bg-card hover:text-foreground"
    >
      <Icon className="size-3" />
      {label}
    </button>
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
  shareToken,
}: {
  content: Inline[];
  resolveLink?: (title: string) => WikiLinkTarget;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (title: string) => void;
  shareToken?: string;
}) {
  const withToken = (src: string) =>
    shareToken && src.startsWith("/api/attachments/")
      ? `${src}?token=${encodeURIComponent(shareToken)}`
      : src;

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
          case "image":
            return (
              /* Attachments are arbitrary user bytes served from our own route:
                 the image optimizer has nothing to add, and would need the file
                 to be addressable as a static asset, which it is not. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={withToken(node.src)}
                alt={node.value}
                loading="lazy"
                className="my-2 block max-h-[420px] w-auto max-w-full rounded-lg border border-line"
              />
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
          case "link": {
            const attachmentId = attachmentIdFrom(node.href);
            if (attachmentId) {
              return (
                <AttachmentCard
                  key={index}
                  id={attachmentId}
                  filename={node.value}
                  shareToken={shareToken}
                />
              );
            }
            return (
              <a
                key={index}
                href={withToken(node.href)}
                target="_blank"
                rel="noreferrer noopener"
                className="text-glow-2 underline underline-offset-2"
              >
                {node.value}
              </a>
            );
          }
          default:
            return <Fragment key={index}>{node.value}</Fragment>;
        }
      })}
    </>
  );
}
