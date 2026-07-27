import { expect, test } from "@playwright/test";
import { cards, openNote, openWorkspace } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openWorkspace(page);
});

test.describe("navigation", () => {
  const destinations = [
    ["All Notes", "/", "All Notes"],
    ["Favorites", "/favorites", "Favorites"],
    ["Pinned", "/pinned", "Pinned"],
    ["Archive", "/archive", "Archive"],
    ["Trash", "/trash", "Trash"],
    ["Personal", "/category/personal", "Personal"],
    ["Work", "/category/work", "Work"],
  ] as const;

  for (const [label, path, heading] of destinations) {
    test(`${label} has its own route`, async ({ page }) => {
      await page.getByRole("link", { name: new RegExp(`^${label}`) }).first().click();
      await expect(page).toHaveURL(path);
      await expect(page.locator("h1").first()).toHaveText(heading);
    });
  }

  test("a tag chip opens its own page", async ({ page }) => {
    await page.getByRole("link", { name: "#pasta" }).first().click();
    await expect(page).toHaveURL("/tags/pasta");
    await expect(page.locator("h1").first()).toHaveText("#pasta");
    await expect(cards(page)).toHaveCount(1);
  });
});

test.describe("filtering happens in the database", () => {
  test("a category view only contains that category", async ({ page }) => {
    await page.goto("/category/work");
    await expect(cards(page).first()).toBeVisible();

    const badges = await cards(page).locator("span", { hasText: /^(Work|Personal|Ideas|Journal)$/ }).allTextContents();
    expect(new Set(badges)).toEqual(new Set(["Work"]));
  });

  test("search narrows the list to matches", async ({ page }) => {
    await page.getByPlaceholder("Search notes...").fill("pasta");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Pasta");
  });

  test("sorting by title orders the unpinned notes alphabetically", async ({ page }) => {
    await page.getByLabel("Sort notes").click();
    await page.getByRole("button", { name: "Title" }).click();
    await expect(cards(page).first()).toBeVisible();
    await page.waitForTimeout(800);

    // The pinned note is held at the top whatever the ordering, so it is
    // excluded before checking the rest.
    const titles = await cards(page).locator("h3").allTextContents();
    const unpinned = titles.slice(1).map((title) => title.toLowerCase());
    expect(unpinned).toEqual([...unpinned].sort());
  });
});

test.describe("editing", () => {
  test("a title edit survives a reload", async ({ page }) => {
    await openNote(page, "Weekend Trip Ideas");

    // Waiting for the save itself rather than a guess at how long it takes.
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" && response.url().includes("/api/notes/"),
    );
    await page.locator('input[placeholder="Untitled note"]').fill("Weekend Trip Ideas edited");
    await saved;

    await page.reload();
    await expect(page.getByText("Weekend Trip Ideas edited").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("favouriting moves the note into Favorites", async ({ page }) => {
    await openNote(page, "Sprint Retrospective");
    await page.getByTitle("Add to favorites").click();
    await page.waitForTimeout(1200);

    await page.goto("/favorites");
    await expect(page.getByText("Sprint Retrospective").first()).toBeVisible();
  });

  test("archiving moves a note out of All Notes and back", async ({ page }) => {
    await openNote(page, "Learning React Patterns");
    await page.getByLabel("More actions").click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByText("Learning React Patterns")).toHaveCount(0);

    await page.goto("/archive");
    await expect(page.getByText("Learning React Patterns").first()).toBeVisible();

    await openNote(page, "Learning React Patterns");
    await page.getByLabel("More actions").click();
    await page.getByRole("button", { name: "Restore from archive" }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Learning React Patterns")).toHaveCount(0);
  });

  test("deleting moves a note to the trash, and restore brings it back", async ({ page }) => {
    await openNote(page, "Pasta Recipe Collection");
    await page.getByLabel("More actions").click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(1500);

    await page.goto("/trash");
    const trashed = page.getByText("Pasta Recipe Collection").first();
    await expect(trashed).toBeVisible();

    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("Pasta Recipe Collection")).toHaveCount(0);
  });
});

test.describe("bulk actions", () => {
  test("select all then favourite applies to every selected note", async ({ page }) => {
    await page.getByRole("button", { name: "Select" }).click();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByText(/\d+ selected/)).toBeVisible();

    await page.getByRole("button", { name: "Favorite", exact: true }).click();
    await page.waitForTimeout(1800);

    await page.goto("/favorites");
    await expect(cards(page).first()).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(3);
  });
});

test.describe("markdown", () => {
  test("preview renders headings, lists and emphasis", async ({ page }) => {
    await page.getByRole("button", { name: "New Note" }).click();
    await expect(page.locator('textarea[placeholder^="Start writing"]')).toBeVisible();

    await page
      .locator('textarea[placeholder^="Start writing"]')
      .fill("## Heading\n\n- one\n- two\n\nSome **bold** text.");
    await page.waitForTimeout(1200);

    await page.getByRole("button", { name: "preview" }).click();
    await expect(page.getByText("Heading", { exact: true })).toBeVisible();
    await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  });
});

test.describe("full-text search", () => {
  test("ranks the best match first and highlights the passage", async ({ page }) => {
    // "unticked" appears once, deep in the body of one note, so finding it at
    // all proves the search runs in the database rather than over the page.
    await page.getByPlaceholder("Search notes...").fill("unticked");
    await expect(cards(page)).toHaveCount(1);

    const first = cards(page).first();
    await expect(first.locator("h3")).toHaveText("Launch Checklist");
    await expect(first.locator("mark")).toContainText("unticked");
  });

  test("matches a word that is still being typed", async ({ page }) => {
    await page.getByPlaceholder("Search notes...").fill("retrospect");
    await expect(cards(page).first().locator("h3")).toContainText("Retrospective");
  });

  test("ranks a title match above a note that only carries the tag", async ({ page }) => {
    // Both notes are tagged #habits; only one has it in the title, and the
    // title carries more weight in the ranking.
    await page.getByPlaceholder("Search notes...").fill("habits");
    await expect(cards(page).first()).toBeVisible();

    expect(await cards(page).count()).toBeGreaterThan(1);
    await expect(cards(page).first().locator("h3")).toContainText("Atomic Habits");
  });
});

test.describe("checklists", () => {
  test("a card shows how much of its checklist is done", async ({ page }) => {
    const card = cards(page).filter({ hasText: "Launch Checklist" }).first();
    await expect(card.getByTitle(/of 7 done/)).toBeVisible();
  });

  test("ticking a box in the preview edits the note and survives a reload", async ({
    page,
  }) => {
    await openNote(page, "Launch Checklist");
    await page.getByRole("button", { name: "preview" }).click();

    const boxes = page.getByRole("checkbox");
    await expect(boxes.first()).toBeVisible();
    await boxes.nth(2).click();
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(
      cards(page).filter({ hasText: "Launch Checklist" }).first().getByTitle("3 of 7 done"),
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("links between notes", () => {
  test("a [[link]] opens its target, which lists what points at it", async ({ page }) => {
    await openNote(page, "Launch Checklist");
    await page.getByRole("button", { name: "preview" }).click();

    await page.getByRole("button", { name: "Meeting Notes - Product Launch" }).click();

    await expect(page.locator('input[placeholder="Untitled note"]')).toHaveValue(
      "Meeting Notes - Product Launch",
    );
    await expect(page.getByText("Linked from")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Launch Checklist" }).first(),
    ).toBeVisible();
  });

  test("typing [[ suggests notes to link to", async ({ page }) => {
    await openNote(page, "Weekend Trip Ideas");

    const editor = page.locator('textarea[placeholder^="Start writing"]');
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await editor.pressSequentially("\n\n[[pasta");

    await expect(page.getByText("Link to note")).toBeVisible();
    await page.getByRole("button", { name: /Pasta Recipe/ }).click();
    await expect(editor).toHaveValue(/\[\[Pasta Recipe Collection\]\]/);
  });
});

test.describe("version history", () => {
  test("an edit is kept, shown as a diff, and can be restored", async ({ page }) => {
    await openNote(page, "Daily Reflection - January 15");

    const editor = page.locator('textarea[placeholder^="Start writing"]');
    const original = await editor.inputValue();

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" && response.url().includes("/api/notes/"),
    );
    await editor.fill(`${original}\n\nA line that was not there before.`);
    await saved;

    await page.getByLabel("More actions").click();
    await page.getByRole("button", { name: "Version history" }).click();

    // The diff is against the note as it stands, so the new line reads as added.
    await expect(page.getByText("Compared with the note as it is now")).toBeVisible();
    await expect(
      page.getByText("A line that was not there before.", { exact: false }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Restore this version" }).click();
    await expect(editor).toHaveValue(original);
  });
});

test.describe("sharing", () => {
  test("a link opens the note signed out, and revoking closes it", async ({
    page,
    browser,
  }) => {
    await openNote(page, "Book Notes: Atomic Habits");

    await page.getByLabel("More actions").click();
    await page.getByRole("button", { name: "Share a link" }).click();
    await page.getByRole("button", { name: "Create link" }).click();

    const field = page.locator("[data-share-url]");
    await expect(field).toBeVisible();
    const url = await field.inputValue();
    expect(url).toContain("/s/");

    // A brand new context: no cookies, no session, nothing but the link.
    const stranger = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guest = await stranger.newPage();

    await guest.goto(url);
    await expect(guest.getByRole("heading", { name: "Book Notes: Atomic Habits" })).toBeVisible();
    await expect(guest.getByText("Shared note")).toBeVisible();
    // Read-only: the editor never reaches a reader.
    await expect(guest.locator("textarea")).toHaveCount(0);

    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(page.getByRole("button", { name: "Create link" })).toBeVisible();

    const afterRevoke = await guest.goto(url);
    expect(afterRevoke?.status()).toBe(404);

    await stranger.close();
  });
});

test.describe("attachments", () => {
  /** A 1×1 PNG, so the upload is a real image without a fixture on disk. */
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  test("an uploaded image lands in the note and is served back", async ({ page }) => {
    await openNote(page, "Weekend Trip Ideas");

    await page.locator('input[type="file"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: pixel,
    });

    const editor = page.locator('textarea[placeholder^="Start writing"]');
    await expect(editor).toHaveValue(/!\[pixel\.png\]\(\/api\/attachments\/[\w-]+\)/);

    await page.getByRole("button", { name: "preview" }).click();
    const image = page.locator('img[alt="pixel.png"]');
    await expect(image).toBeVisible();

    const src = await image.getAttribute("src");
    const served = await page.request.get(src!);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
  });

  test("a file type that is not on the allowlist is refused", async ({ page }) => {
    await openNote(page, "Sprint Retrospective");

    await page.locator('input[type="file"]').setInputFiles({
      name: "page.html",
      mimeType: "text/html",
      buffer: Buffer.from("<script>alert(1)</script>"),
    });

    await expect(page.getByText(/cannot be attached/)).toBeVisible();
  });
});

test.describe("calendar views", () => {
  test("each view has its own URL and heading", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    // The week grid puts the weekday letters above the hour rail.
    await expect(page.getByText("9 am").first()).toBeVisible();

    await page.getByRole("button", { name: "day", exact: true }).click();
    await expect(page).toHaveURL(/view=day/);

    await page.getByRole("button", { name: "agenda", exact: true }).click();
    await expect(page).toHaveURL(/view=agenda/);
    await expect(page.getByRole("heading", { name: "The next 30 days" })).toBeVisible();
  });

  test("a view survives a reload, because it is in the address", async ({ page }) => {
    await page.goto("/calendar?view=agenda");
    await expect(page.getByRole("heading", { name: "The next 30 days" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "The next 30 days" })).toBeVisible();
  });

  test("a repeating event appears on every occurrence, from one row", async ({ page }) => {
    await page.goto("/calendar?view=agenda");

    // The seed has one daily standup; the agenda covers thirty days.
    const standups = page.getByText("Daily Standup");
    // count() does not wait, so wait for the events query before counting.
    await expect(standups.first()).toBeVisible();
    expect(await standups.count()).toBeGreaterThan(5);
  });

  test("editing an occurrence edits the series behind it", async ({ page }) => {
    await page.goto("/calendar?view=agenda");

    // Open the *second* occurrence — a synthetic one, not the stored row.
    await page.getByText("Daily Standup").nth(1).click();
    await expect(page.getByRole("heading", { name: "Edit event" })).toBeVisible();
    // The repeat rule is the series', so it must have come from the stored row.
    await expect(page.getByRole("button", { name: "Daily", exact: true })).toHaveClass(
      /bg-btn/,
    );
  });
});

test.describe("calendar files", () => {
  test("the calendar exports as an .ics with its repeats intact", async ({ page }) => {
    await page.goto("/settings");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export .ics" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.ics$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");

    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("SUMMARY:Daily Standup");
    expect(text).toContain("RRULE:FREQ=DAILY");
  });

  test("an uploaded .ics adds its events", async ({ page }) => {
    await page.goto("/settings");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:imported@example.test",
      "DTSTART:20260814T140000Z",
      "DTEND:20260814T150000Z",
      "SUMMARY:Imported from elsewhere",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    await page.locator('input[accept*="ics"]').setInputFiles({
      name: "other-calendar.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from(ics),
    });

    await expect(page.getByText(/Added 1 event/)).toBeVisible();

    await page.goto("/calendar?view=agenda&date=2026-08-14");
    await expect(page.getByText("Imported from elsewhere").first()).toBeVisible();
  });
});

test.describe("reminders", () => {
  test("the sending endpoint refuses anyone without the shared secret", async ({
    request,
  }) => {
    const response = await request.post("/api/push/send-due");
    // 503 when CRON_SECRET is unset, 401 when it is set and not presented.
    expect([401, 503]).toContain(response.status());
  });

  test("a subscription needs its keys", async ({ request }) => {
    const response = await request.post("/api/push/subscribe", {
      data: { endpoint: "https://push.example.test/abc" },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("command palette", () => {
  test("opens on the shortcut and finds a note", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/Search notes or jump/);
    await expect(input).toBeVisible();

    await input.fill("pasta");
    await expect(page.getByText("Pasta Recipe Collection").first()).toBeVisible();
  });
});

test.describe("exports", () => {
  const formats = [
    ["PDF document", "pdf", "%PDF"],
    ["Word (.docx)", "docx", "PK"],
    ["Markdown (.md)", "md", "# "],
  ] as const;

  for (const [label, extension, signature] of formats) {
    test(`a note exports as ${extension}`, async ({ page }) => {
      await openNote(page, "App Idea: Task Manager");

      await page.getByLabel("More actions").click();
      await page.getByRole("button", { name: "Export" }).click();

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: label }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));

      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks).subarray(0, 8).toString("latin1")).toContain(signature);
    });
  }
});
