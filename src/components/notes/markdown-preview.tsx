"use client";

import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";

/** Renders the shared markdown blocks. No HTML from the note is ever injected. */
export function MarkdownPreview({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

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
                <InlineRun content={block.content} />
              </p>
            );
          }
          case "bullet":
            return (
              <div key={index} className="flex gap-2 pl-1">
                <span className="shrink-0 text-muted-2">
                  {block.ordered ? block.marker : "•"}
                </span>
                <span>
                  <InlineRun content={block.content} />
                </span>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="border-l-2 border-glow-1 pl-3 text-muted italic"
              >
                <InlineRun content={block.content} />
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
                <InlineRun content={block.content} />
              </p>
            );
        }
      })}
    </div>
  );
}

function InlineRun({ content }: { content: Inline[] }) {
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
