import { describe, expect, it } from "vitest";
import { emailShareUrl, whatsappShareUrl } from "./share-targets";

describe("share targets", () => {
  it("builds a mailto composer with no fixed recipient", () => {
    const target = emailShareUrl("Launch plan", "https://notes.test/s/abc");
    const query = new URLSearchParams(target.slice("mailto:?".length));

    expect(target.startsWith("mailto:?")).toBe(true);
    expect(query.get("subject")).toBe("Nexora note: Launch plan");
    expect(query.get("body")).toContain("https://notes.test/s/abc");
  });

  it("builds a WhatsApp contact-picker URL with the note link", () => {
    const target = new URL(
      whatsappShareUrl("Launch plan", "https://notes.test/s/abc"),
    );

    expect(target.origin).toBe("https://wa.me");
    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("text")).toContain("https://notes.test/s/abc");
  });
});
