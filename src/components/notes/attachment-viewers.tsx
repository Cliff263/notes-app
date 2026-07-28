"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PdfDocument({
  data,
  filename,
  onError,
}: {
  data: ArrayBuffer;
  filename: string;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let settled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const renderTasks: { cancel: () => void }[] = [];
    const timeout = window.setTimeout(() => {
      if (!settled && active) onError();
    }, 20_000);
    container.replaceChildren();

    // The legacy build retains compatibility shims needed by some Edge and
    // installed-PWA runtimes. Keep the viewer and worker on the same build;
    // mixing the standard viewer with a legacy worker (or vice versa) can make
    // a valid PDF fail before the first page is rendered.
    void import("pdfjs-dist/legacy/build/pdf.mjs")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
        loadingTask = task;
        const pdfDocument = await task.promise;

        for (
          let pageNumber = 1;
          pageNumber <= pdfDocument.numPages;
          pageNumber += 1
        ) {
          if (!active) return;
          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(
            320,
            Math.min(900, container.clientWidth - 48),
          );
          const cssScale = availableWidth / baseViewport.width;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: cssScale * pixelRatio });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas is unavailable");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`;
          canvas.style.height = `${Math.ceil(viewport.height / pixelRatio)}px`;
          canvas.className = "pdf-preview-page";
          canvas.setAttribute("aria-label", `Page ${pageNumber}`);
          container.append(canvas);

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
          });
          renderTasks.push(renderTask);
          await renderTask.promise;
        }
        settled = true;
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      })
      .catch(() => {
        settled = true;
        window.clearTimeout(timeout);
        if (active) onError();
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      renderTasks.forEach((task) => task.cancel());
      void loadingTask?.destroy();
      container.replaceChildren();
    };
  }, [data, onError]);

  return (
    <div className="relative h-full min-h-[36rem] w-full overflow-auto bg-zinc-800 scroll-thin">
      {loading && (
        <p className="sticky left-1/2 top-6 z-10 w-fit -translate-x-1/2 rounded-full bg-zinc-950/80 px-3 py-1.5 text-[11px] text-zinc-300">
          Rendering PDF…
        </p>
      )}
      <div
        ref={containerRef}
        role="document"
        aria-label={filename}
        className="pdf-preview-canvas flex min-h-full flex-col items-center px-3 py-6 sm:px-8"
      />
    </div>
  );
}

export function MarkdownDocument({ text }: { text: string }) {
  return (
    <DocumentCanvas>
      <article className="document-markdown min-h-[70rem] bg-white px-8 py-12 text-zinc-900 shadow-2xl sm:px-16 sm:py-20">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </article>
    </DocumentCanvas>
  );
}

export function TextDocument({ text }: { text: string }) {
  return (
    <DocumentCanvas>
      <pre className="min-h-[70rem] whitespace-pre-wrap bg-white px-8 py-12 text-left font-mono text-[12px] leading-6 text-zinc-900 shadow-2xl sm:px-16 sm:py-20">
        {text}
      </pre>
    </DocumentCanvas>
  );
}

function DocumentCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full w-full bg-zinc-800 px-3 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[850px]">{children}</div>
    </div>
  );
}

type GridCell = {
  text: string;
  style?: CSSProperties;
  colSpan?: number;
  rowSpan?: number;
  hidden?: boolean;
};

type GridSheet = {
  name: string;
  rows: GridCell[][];
  columnWidths?: number[];
  rowHeights?: number[];
};

export function SpreadsheetDocument({
  data,
  text,
  extension,
  filename,
  onError,
}: {
  data?: ArrayBuffer;
  text?: string;
  extension: string;
  filename: string;
  onError: () => void;
}) {
  const [sheets, setSheets] = useState<GridSheet[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const textSheets = useMemo<GridSheet[] | null>(
    () =>
      text == null
        ? null
        : [
            {
              name:
                extension === "csv" || extension === "tsv" ? "Data" : filename,
              rows: parseDelimited(
                text,
                extension === "tsv" ? "\t" : undefined,
              ),
            },
          ],
    [extension, filename, text],
  );

  useEffect(() => {
    let active = true;
    if (data && extension === "xlsx") {
      void parseXlsx(data)
        .then((parsed) => {
          if (active) setSheets(parsed);
        })
        .catch(() => {
          if (active) onError();
        });
    }
    return () => {
      active = false;
    };
  }, [data, extension, onError]);

  const availableSheets = sheets ?? textSheets;
  const sheet = availableSheets?.[activeSheet];
  if (!sheet) {
    return <p className="text-[12px] text-zinc-400">Preparing spreadsheet…</p>;
  }

  return (
    <div
      role="document"
      aria-label={filename}
      className="flex h-full min-h-[36rem] w-full flex-col overflow-hidden bg-zinc-800"
    >
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6 scroll-thin">
        <table className="mx-auto border-collapse bg-white text-[12px] text-zinc-900 shadow-2xl">
          {sheet.columnWidths && (
            <colgroup>
              {sheet.columnWidths.map((width, index) => (
                <col key={index} style={{ width, minWidth: width }} />
              ))}
            </colgroup>
          )}
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={
                  sheet.rowHeights?.[rowIndex]
                    ? { height: sheet.rowHeights[rowIndex] }
                    : undefined
                }
              >
                {row.map((cell, columnIndex) =>
                  cell.hidden ? null : (
                    <td
                      key={columnIndex}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      style={cell.style}
                      className="min-w-24 border border-zinc-300 px-2 py-1.5 align-top whitespace-pre-wrap"
                    >
                      {cell.text}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-white/10 bg-zinc-950 px-3 pt-2">
        {availableSheets.map((item, index) => (
          <button
            key={`${item.name}-${index}`}
            type="button"
            onClick={() => setActiveSheet(index)}
            className={`shrink-0 rounded-t-md px-4 py-2 text-[11px] ${
              index === activeSheet
                ? "bg-white text-zinc-900"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

async function parseXlsx(data: ArrayBuffer): Promise<GridSheet[]> {
  const excelModule = await import("exceljs");
  const workbook = new excelModule.Workbook();
  await workbook.xlsx.load(data as never);

  return workbook.worksheets.map((worksheet) => {
    const merges = new Map<string, { colSpan: number; rowSpan: number }>();
    const mergedChildren = new Set<string>();
    const ranges =
      (worksheet.model as typeof worksheet.model & { merges?: string[] }).merges ??
      [];

    ranges.forEach((range) => {
      const [start, end] = range.split(":").map(parseCellAddress);
      merges.set(`${start.row}:${start.column}`, {
        colSpan: end.column - start.column + 1,
        rowSpan: end.row - start.row + 1,
      });
      for (let row = start.row; row <= end.row; row += 1) {
        for (let column = start.column; column <= end.column; column += 1) {
          if (row !== start.row || column !== start.column) {
            mergedChildren.add(`${row}:${column}`);
          }
        }
      }
    });

    const rowCount = Math.min(
      500,
      Math.max(worksheet.actualRowCount, worksheet.rowCount, 1),
    );
    const columnCount = Math.min(
      100,
      Math.max(worksheet.actualColumnCount, worksheet.columnCount, 1),
    );
    const rows: GridCell[][] = [];
    const rowHeights: number[] = [];

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      rowHeights.push(row.height ? row.height * 1.33 : 24);
      const cells: GridCell[] = [];
      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        const merge = merges.get(`${rowIndex}:${columnIndex}`);
        cells.push({
          text: cell.text,
          style: excelCellStyle(cell),
          colSpan: merge?.colSpan,
          rowSpan: merge?.rowSpan,
          hidden: mergedChildren.has(`${rowIndex}:${columnIndex}`),
        });
      }
      rows.push(cells);
    }

    return {
      name: worksheet.name,
      rows,
      rowHeights,
      columnWidths: Array.from({ length: columnCount }, (_, index) => {
        const width = worksheet.getColumn(index + 1).width;
        return Math.max(96, Math.min(480, (width ?? 12) * 7 + 12));
      }),
    };
  });
}

function excelCellStyle(cell: {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    color?: { argb?: string };
  };
  fill?: {
    type?: string;
    fgColor?: { argb?: string };
  };
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
  };
  border?: Record<
    string,
    { style?: string; color?: { argb?: string } } | undefined
  >;
}): CSSProperties {
  const style: CSSProperties = {};
  const color = excelColor(cell.font?.color?.argb);
  const background = excelColor(cell.fill?.fgColor?.argb);
  if (cell.font?.name) style.fontFamily = cell.font.name;
  if (cell.font?.size) style.fontSize = `${cell.font.size}pt`;
  if (cell.font?.bold) style.fontWeight = 700;
  if (cell.font?.italic) style.fontStyle = "italic";
  if (cell.font?.underline) style.textDecoration = "underline";
  if (color) style.color = color;
  if (cell.fill?.type === "pattern" && background) style.backgroundColor = background;
  if (cell.alignment?.horizontal) {
    style.textAlign =
      cell.alignment.horizontal === "centerContinuous"
        ? "center"
        : (cell.alignment.horizontal as CSSProperties["textAlign"]);
  }
  if (cell.alignment?.vertical) {
    style.verticalAlign = cell.alignment.vertical;
  }
  if (cell.alignment?.wrapText) style.whiteSpace = "pre-wrap";

  (["top", "right", "bottom", "left"] as const).forEach((side) => {
    const border = cell.border?.[side];
    if (!border?.style) return;
    const borderColor = excelColor(border.color?.argb) ?? "#a1a1aa";
    const width = border.style.includes("thick")
      ? 3
      : border.style.includes("medium") || border.style === "double"
        ? 2
        : 1;
    const lineStyle = border.style.includes("dash") ? "dashed" : "solid";
    style[
      `border${side[0].toUpperCase()}${side.slice(1)}` as keyof CSSProperties
    ] = `${width}px ${lineStyle} ${borderColor}` as never;
  });
  return style;
}

function excelColor(argb?: string) {
  if (!argb || !/^[\dA-F]{8}$/i.test(argb)) return undefined;
  return `#${argb.slice(2)}`;
}

function parseCellAddress(address: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) return { row: 1, column: 1 };
  let column = 0;
  for (const character of match[1].toUpperCase()) {
    column = column * 26 + character.charCodeAt(0) - 64;
  }
  return { row: Number(match[2]), column };
}

function parseDelimited(text: string, explicitDelimiter?: string): GridCell[][] {
  const delimiter =
    explicitDelimiter ??
    (text.split("\n", 1)[0]?.includes("\t") ? "\t" : ",");
  const rows: GridCell[][] = [];
  let row: GridCell[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index <= text.length; index += 1) {
    const character = text[index] ?? "\n";
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push({ text: value });
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push({ text: value });
      if (row.some((cell) => cell.text.length)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  return rows.length ? rows : [[{ text: "" }]];
}

export function PresentationDocument({
  data,
  filename,
  onError,
}: {
  data: ArrayBuffer;
  filename: string;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stableData = useMemo(() => data.slice(0), [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let viewer: {
      destroy: () => void;
      preview: (file: ArrayBuffer) => Promise<unknown>;
    } | null = null;
    container.replaceChildren();

    void import("pptx-preview")
      .then(async ({ init }) => {
        if (!active) return;
        viewer = init(container, { width: 960, height: 540, mode: "list" });
        await viewer.preview(stableData);
      })
      .catch(() => {
        if (active) onError();
      });

    return () => {
      active = false;
      viewer?.destroy();
      container.replaceChildren();
    };
  }, [onError, stableData]);

  return (
    <div className="h-full min-h-[36rem] w-full overflow-auto bg-zinc-800 px-3 py-6 sm:px-8 scroll-thin">
      <div
        ref={containerRef}
        role="document"
        aria-label={filename}
        className="presentation-preview mx-auto min-w-[960px] max-w-[960px]"
      />
    </div>
  );
}
