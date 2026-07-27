import { describe, expect, it } from "vitest";
import {
  attachmentIdFrom,
  attachmentMarkdown,
  formatBytes,
  isAllowedMime,
  isImageMime,
} from "./attachments";
import { fitWithin, imageSize } from "./image-size";

/** A 2×3 PNG, built by hand so the test needs no fixture on disk. */
function png(width: number, height: number) {
  const header = Buffer.alloc(24);
  header.writeUInt32BE(0x89504e47, 0);
  header.writeUInt32BE(0x0d0a1a0a, 4);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

describe("the allowlist", () => {
  it("accepts what it can safely serve back", () => {
    expect(isAllowedMime("image/png")).toBe(true);
    expect(isAllowedMime("application/pdf")).toBe(true);
  });

  it("refuses anything a browser might run", () => {
    expect(isAllowedMime("text/html")).toBe(false);
    expect(isAllowedMime("image/svg+xml")).toBe(false);
    expect(isAllowedMime("application/javascript")).toBe(false);
    expect(isAllowedMime("")).toBe(false);
  });

  it("does not mistake an inherited property for an allowed type", () => {
    expect(isAllowedMime("constructor")).toBe(false);
    expect(isAllowedMime("toString")).toBe(false);
  });
});

describe("attachment markdown", () => {
  it("embeds an image and links anything else", () => {
    expect(
      attachmentMarkdown({ id: "abc", filename: "shot.png", mime: "image/png" }),
    ).toBe("![shot.png](/api/attachments/abc)");

    expect(
      attachmentMarkdown({ id: "abc", filename: "spec.pdf", mime: "application/pdf" }),
    ).toBe("[spec.pdf](/api/attachments/abc)");
  });

  it("recognises its own sources and ignores everyone else's", () => {
    expect(attachmentIdFrom("/api/attachments/abc-123")).toBe("abc-123");
    expect(attachmentIdFrom("https://example.test/cat.png")).toBeNull();
    expect(attachmentIdFrom("/api/notes/abc")).toBeNull();
  });

  it("is not fooled by a source that only starts the same way", () => {
    expect(attachmentIdFrom("https://evil.test/api/attachments/abc")).toBeNull();
  });
});

describe("imageSize", () => {
  it("reads a PNG header", () => {
    expect(imageSize(png(640, 480), "image/png")).toEqual({ width: 640, height: 480 });
  });

  it("gives up on a format it cannot read rather than guessing", () => {
    expect(imageSize(Buffer.from("not an image"), "image/png")).toBeNull();
    expect(imageSize(png(10, 10), "image/webp")).toBeNull();
  });

  it("scales down to fit but never up", () => {
    expect(fitWithin({ width: 1000, height: 500 }, 400, 400)).toEqual({
      width: 400,
      height: 200,
    });
    expect(fitWithin({ width: 100, height: 50 }, 400, 400)).toEqual({
      width: 100,
      height: 50,
    });
  });
});

describe("formatBytes", () => {
  it("reads the way a person would say it", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("isImageMime", () => {
  it("separates pictures from files", () => {
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
  });
});
