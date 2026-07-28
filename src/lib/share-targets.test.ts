import { describe, expect, it } from "vitest";
import { attachmentFilename, noteExportUrl } from "./share-targets";

describe("file share targets", () => {
  it("uses the authenticated note export route", () => {
    expect(noteExportUrl("note/one", "pdf")).toBe(
      "/api/notes/note%2Fone/export?format=pdf",
    );
  });

  it("reads the export filename from Content-Disposition", () => {
    expect(
      attachmentFilename(
        'attachment; filename="launch-plan.docx"',
        "note.docx",
      ),
    ).toBe("launch-plan.docx");
  });

  it("supports encoded attachment filenames", () => {
    expect(
      attachmentFilename(
        "attachment; filename*=UTF-8''meeting%20notes.md",
        "note.md",
      ),
    ).toBe("meeting notes.md");
  });
});
