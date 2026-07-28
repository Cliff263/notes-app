# Nexora

A note-taking workspace with a three-pane layout — categories and tags on the left,
note cards in the middle, a live editor on the right — plus a calendar page that shows
scheduled events and everything coming up.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion,
Zustand, Drizzle ORM and Neon Postgres. Auth.js handles email/password and Google
sign-in.

## What's in it

**Notes**

- Create, edit, duplicate, archive and delete notes; edits save automatically
- Pin, favorite and tag, each with its own page
- Ranked full-text search across titles, bodies and tags
- Checklists you can tick from the preview, with progress on the card
- `[[Link]]` one note to another, and see what links back
- Grid or list layout, dark or light theme

Every destination in the sidebar is a real route, so views are linkable and
survive a refresh:

| Route | Shows |
| --- | --- |
| `/` | All notes except the archive |
| `/favorites` | Starred notes |
| `/pinned` | Pinned notes |
| `/archive` | Archived notes, with restore (one note or all at once) |
| `/trash` | Deleted notes, kept 30 days, with restore or delete forever |
| `/category/[category]` | Personal, Work, Ideas or Journal |
| `/tags` | Every tag with its count and example notes |
| `/tags/[tag]` | Notes carrying that tag |
| `/calendar` | Month, week, day and agenda views, plus what's upcoming |
| `/settings` | Profile, appearance, export, account |
| `/s/[token]` | A shared note — readable, and editable if the link says so — without an account |

A new note inherits the view you create it from — from `/category/work` it lands
in Work, from `/tags/react` it arrives already tagged `#react`.

**Writing**

- Markdown with a formatting toolbar, a Write/Preview toggle, and lists that
  continue when you press Enter
- Headings, lists, quotes, code and emphasis render in the preview and carry
  through to PDF and Word exports
- `- [ ]` makes a checklist. The preview turns each item into a checkbox, and
  ticking one rewrites that line of the note — there is no second copy of the
  state to fall out of step. The card shows `3/7` and a progress bar, and the
  boxes survive into every export.
- `[[Another note]]` links to a note by title, `[[Another note|as this]]` if you
  want different link text. Type `[[` and a completion menu offers your notes;
  a link to a title that does not exist yet renders as an offer to create it.
  The note being pointed at lists its incoming links under "Linked from".
- Paste a screenshot, drop a file on the editor, or use the paperclip. Images
  appear in the preview and are embedded into PDF and Word exports; anything
  else becomes a link. Up to 5 MB per file, from a fixed list of types.

**History and sharing**

- Every note keeps its last 30 versions. A run of small edits collapses into one
  snapshot, so history reads as a list of sessions rather than keystrokes, but a
  paste or a large deletion always earns its own entry. ⋯ → **Version history**
  shows a line-by-line diff against the note as it stands, and restores any
  version — restoring is itself an edit, so nothing is lost by trying it.
- ⋯ → **Share a link** publishes the note at `/s/<token>`. Anyone with the link
  can open it without an account. Links can expire after a day, a week or a
  month, and "Stop sharing" withdraws one immediately. Each note has at most one
  link, so revoking is never a question of which link you meant. Shared pages
  are marked `noindex`, and images inside a shared note are served against the
  same token.
- Tick **Let them edit it too** and the link carries an editor as well. See
  below for what that actually does.

**Editing together**

Two people on the same editable link edit the same note at the same time, and
see each other's keystrokes as they happen. Underneath:

- The document is a CRDT (Yjs), so edits merge rather than overwrite, and each
  keystroke is sent as the smallest change that explains it rather than as the
  whole note.
- The connection is peer to peer over WebRTC. A signalling server introduces the
  two browsers and sees nothing but that introduction — no note content passes
  through it. The room is named after the **share token**, never the note's id,
  so no internal identifier is broadcast anywhere.
- Presence shows who else is on the page. Remote carets are not drawn: a plain
  textarea has no way to position them, and a mirrored overlay would cost more
  in fragility than it returns.
- **Saving does not depend on any of this.** Both sides write through ordinary
  requests — the owner through the notes API, the guest through the share's own
  endpoint — so if signalling is unreachable, editing carries on, the page says
  "Editing on your own", and nothing is lost. Live sync is the nice part;
  durability is the part that has to hold.
- Everything a guest writes goes into the note's version history like any other
  edit, so an unwelcome change can be found and rolled back.

Point `NEXT_PUBLIC_YJS_SIGNALING` at your own signalling server if you would
rather not use the public one. `y-webrtc` ships one:

```bash
node node_modules/y-webrtc/bin/server.js --port 4444
# then NEXT_PUBLIC_YJS_SIGNALING="ws://127.0.0.1:4444"
```

**Search**

Typing in the search box runs a ranked Postgres full-text query, not a substring
scan:

- Titles outrank bodies, which outrank tags, so the note you meant is usually
  first. Sorting by anything other than "Last edited" overrides the ranking.
- The last word is matched as a prefix, so results appear while you are still
  typing it.
- Each result shows the passage that matched, with the matched words
  highlighted, instead of the note's opening line.

`npm run db:extras` builds the GIN index that makes this fast. It is worth
running, but it is not required for correctness — the same query returns the
same rows without it, it just scans to find them.

One consequence of real search: words are matched whole (plus that trailing
prefix), so "nage" no longer finds "management". Searching for punctuation on
its own still falls back to a substring match.

**Getting around**

- ⌘K / Ctrl K opens a command palette that searches note titles and content and
  jumps to any view
- `N` new note, `/` search, `E` favorite, `P` pin, `A` archive, `G` then a
  letter to navigate, `?` for the full list
- Sort any view by last edited, date created, title or length

**Safety net**

- Deleting moves a note to `/trash`, where it can be restored or removed for
  good; nothing is lost to a mis-tap
- Select mode for bulk favorite, pin, archive and delete

**Calendar and notes together**

- Give a note a due date and it appears in the calendar's "Notes due" list
- "Add to calendar" creates an event from the note and links them both ways
- Linked events automatically follow changes to the note or journal title,
  content excerpt and due date

**Tables, spreadsheets and attachments**

- Insert an editable table from the note toolbar, then add/remove rows and
  columns or edit individual cells in Preview
- CSV spreadsheets are attached in their original form and imported as an
  editable table inside the note
- Images, PDFs, text, Markdown, Excel/OpenDocument spreadsheets, Word documents
  and PowerPoint presentations can be attached by picker, paste or drag-and-drop

**On a phone**

- Sidebar becomes a drawer, a bottom tab bar replaces it, and the editor opens
  as a full-screen sheet
- The month view switches to a dot grid with the day's agenda underneath
- Installable as an app (PWA) with a service worker, so notes stay readable
  offline and edits made offline are replayed when the connection returns

**Export**

Any note can be downloaded as **PDF**, **Word (.docx)**, **Markdown** or **plain
text** from the ⋯ menu in the editor. Settings has an "Export every note" section
that packs the whole workspace into a single document, optionally including the
archive. Documents are generated server-side (`pdf-lib` and `docx`), so nothing
depends on the browser's print dialog.

**Calendar** (`/calendar`)

Four views, each a real address — `?view=week&date=2026-07-27` is a link you can
send someone, and a refresh comes back to where you were:

| View | What it is for |
| --- | --- |
| Month | The shape of the month. A glowing "today" cell over a faint grid. |
| Week | Seven columns of hours, with all-day events in a strip above and a line across today at the current time. |
| Day | The same grid, one column wide. |
| Agenda | The next thirty days as a list, grouped by day — the view that answers "what is actually happening". |

- Coloured event pills; click one to edit, double-click a day (or an hour, in
  the week and day views) to add one there
- Overlapping events share the column between them rather than hiding each other
- A side panel with the selected day's schedule and what's coming next, labelled
  "Today", "Tomorrow", "in 3 days" and so on

**Repeating events**

An event can repeat daily, weekly, monthly or yearly, every *n* of those, and
stop on a date or after a number of times. A repeating event is **one row**: the
occurrences are worked out for whatever window a view is showing, so a daily
standup does not become three hundred rows a year. Editing any occurrence edits
the series behind it.

The rule is stored as an RRULE, which is what a calendar file uses, so it needs
no translation on the way out. Per-occurrence exceptions ("skip this Tuesday")
are deliberately not supported.

**Taking the calendar elsewhere**

Settings has **Export .ics** and **Import .ics**. The exporter writes proper
iCalendar — CRLF, escaped values, folded lines, RRULEs intact — and the importer
reads files written by other calendars, including all-day events and `TZID`
times. Importing adds; it never overwrites, because matching on another
calendar's UID would mean trusting its idea of identity.

**Reminders**

Opt in per device from Settings and Nexora will notify you shortly before
an event starts and when a note falls due. It needs three things: VAPID keys on
the deployment, a browser that supports push, and your permission — the toggle
says which one is missing rather than just refusing.

Delivery is driven by `POST /api/push/send-due`, guarded by `CRON_SECRET`;
`vercel.json` schedules it every thirty minutes. There is no record of what has
already been sent — each notification carries a `tag`, which is how the browser
collapses a repeat into the one notification, so running the job more often than
its window is harmless. A subscription the push service reports as gone is
deleted rather than retried.

**Account**

- Email/password sign-up, or Google if you configure it
- A new account starts with a clean workspace, ready for its first note or event
- `/settings` for your display name, theme, default layout and account deletion

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string (use the **pooled** one from the Neon dashboard) |
| `AUTH_SECRET` | yes | Generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` | no | From a Google Cloud OAuth client |
| `AUTH_GOOGLE_SECRET` | no | Same |
| `RESEND_API_KEY` | no | Sends password-reset and confirmation email. Without it the links are logged to the server console instead, so the flow still works locally |
| `EMAIL_FROM` | no | Defaults to Resend's onboarding sender |
| `R2_ACCOUNT_ID` | no | Cloudflare account ID; enables private R2 attachment storage when all four R2 values are set |
| `R2_ACCESS_KEY_ID` | no | From an R2 Object Read & Write API token scoped to the attachment bucket |
| `R2_SECRET_ACCESS_KEY` | no | The token's secret; server-only |
| `R2_BUCKET_NAME` | no | Private bucket used for original attachment objects |
| `VAPID_PUBLIC_KEY` | no | Reminders. Generate a pair with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | no | The other half of that pair |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no | The public key again, this time where the browser can read it |
| `VAPID_SUBJECT` | no | A `mailto:` the push service can contact you at |
| `CRON_SECRET` | no | Shared secret the reminder job must present. Unset, that endpoint answers 503 and reminders are never sent |
| `NEXT_PUBLIC_YJS_SIGNALING` | no | Comma-separated signalling servers for collaborative editing. Defaults to a public one |

Leave the Google variables unset and the "Continue with Google" button simply
doesn't render — email/password still works.

### Cloudflare R2 attachments

Create a private R2 bucket, then in **Storage & databases → R2 → Manage API
tokens** create an Object Read & Write token scoped only to that bucket. Put the
account ID, access key ID, secret access key and bucket name into the four `R2_*`
variables above. The app uses R2's S3-compatible endpoint with region `auto`.

Objects remain private. Uploads use a 15-minute presigned `PUT` URL so videos do
not pass through the application server; reads stream through
`/api/attachments/[id]`, where note/share authorization is enforced. Add this
CORS policy to the bucket, replacing the origins with the app's real addresses:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The bucket itself stays private and needs no custom domain. Without complete R2
credentials, local development falls back to Postgres and keeps the smaller
5 MB limit.

For Google sign-in, add `http://localhost:3000/api/auth/callback/google` as an
authorized redirect URI on the OAuth client (and your production URL when you deploy).

### 3. Create the tables

```bash
npm run db:push
```

Run this again after pulling changes that add columns or tables. Everything so
far has been additive: `notes.deletedAt`, `notes.dueAt` and `events.noteId` for
trash, due dates and note-to-event links, then the `noteVersion`, `noteShare`
and `attachment` tables for history, sharing and files, then `events.recurrence`
and the `pushSubscription` table for repeats and reminders.
Attachment storage later added `storageKey` and made the legacy `data` column
nullable, so run `npm run db:push` when adopting R2.

`db:push` finishes by running `db:extras`, which adds what a Drizzle schema
cannot describe — today that is the GIN index behind full-text search, built
over an expression rather than a column. Because that index is not in the
schema, `drizzle-kit` will offer to drop it as something it does not recognise;
answer either way, `db:extras` puts it back. You can also run
`npm run db:extras` on its own at any time.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000, create an account, and your workspace is populated.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:extras` | Create the indexes the schema cannot express (full-text search) |
| `npm run db:generate` | Generate SQL migration files |
| `npm run db:studio` | Drizzle Studio |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

## Running against a local Postgres

Neon is the target, but any Postgres works for local development — the driver is
chosen from the host in `DATABASE_URL`. A non-Neon host uses `node-postgres`
instead of Neon's HTTP driver, so this is enough:

```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/notes"
```

Then `npm run db:push` as usual.

## Accounts and safety

- Sign-up, sign-in, password reset and confirmation links are all rate limited.
  Guessing one account is capped tightly; a shared address is capped loosely, so
  an office behind one IP is not locked out by its neighbours.
- "Forgot password" always answers the same way, so it cannot be used to find
  out which addresses have accounts.
- Reset and confirmation tokens are stored only as hashes, expire, and are
  single-use.
- Share tokens are 32 random bytes and *are* stored as written, because unlike a
  reset link they are meant to be copied again tomorrow. They grant access to
  one note and nothing else — and only editing if the link was created that way,
  which the write endpoint checks on every request. Public reads and writes are
  both rate limited.
- Attachments are accepted only from a fixed list of types, so nothing a browser
  would execute can be stored. Everything but an image is served as a download
  rather than inline, with `X-Content-Type-Options: nosniff`.

## Tests

```bash
npm test        # unit: markdown parsing, rate limiting, formatting, exports
npm run test:e2e  # end to end, against a running app and a real database
```

The end-to-end suite rebuilds its own account and test fixtures before each run, so
runs cannot contaminate each other. It signs in once and reuses the session.
Point it at an already-running server with `E2E_BASE_URL`, and at a
pre-installed browser with `PLAYWRIGHT_CHROMIUM_PATH`.

One test is skipped unless you ask for it: two browsers converging on the same
note needs a signalling server to introduce them. Start one, point
`NEXT_PUBLIC_YJS_SIGNALING` at it, and set `E2E_SIGNALING=1`.

## How it's organised

```
src/
  app/
    (auth)/login, (auth)/signup   Sign-in and sign-up screens
    api/                          Route handlers for notes, events, account, auth, export
    s/[token]/                    A publicly shared note, read-only or editable
    favorites/, pinned/, archive/ Note views
    category/[category]/          One view per category
    tags/, tags/[tag]/            Tag index and per-tag view
    calendar/                     Calendar page (month, week, day, agenda)
    settings/                     Account, appearance and export
    page.tsx                      All notes
  components/
    auth/                         Auth shell and form
    calendar/                     Month grid, time grid, agenda, upcoming panel, event modal
    notes/                        Note cards, list pane, editor
    sidebar.tsx                   Shared navigation
    workspace.tsx                 The three-pane shell each note route renders
  db/                             Drizzle schema and database client
  store/                          Zustand stores for notes and events
  lib/                            Types, routes, formatting, export builders, session guard
  auth.ts, auth.config.ts         Auth.js configuration
  proxy.ts                        Route protection (Next 16's middleware)
```

A repeating event is stored once and expanded when a view asks for a range
(`src/lib/recurrence.ts`), which is also what the reminder job uses to work out
what is about to start. The same module parses the RRULE that goes into an .ics,
so there is one definition of what "repeats" means.

Every note and event row carries a `userId`, and each API route resolves the user
from the session before it touches the database — a request can only ever read or
write its own rows. The two routes a signed-out visitor can reach, a shared note
and the images inside one, take the share token in place of a session and check
that it names the note being asked for.

Attachment metadata stays in Postgres. Original bytes use a private Cloudflare
R2 bucket when configured, with Postgres `bytea` retained as a 5 MB local
fallback and for files uploaded before R2 was enabled. R2 reads are proxied
through the authenticated attachment route, and deleting an attachment, note or
account also removes its object. The driver disagreement about what a `bytea`
looks like in JavaScript is settled in `src/db/schema.ts`, which sends and reads
legacy bytes as hex.

The note list is paginated with a cursor and filtered, searched and ordered in
SQL, so a filtered view shows every match rather than only the ones that happened
to load. Counts and the tag cloud come from a separate aggregate endpoint, which
keeps them correct however little of the list is on screen.

Search is ranked in the database too. The weighted `tsvector` lives in one place
(`src/lib/search.ts`) and both the query and the index in `scripts/db-extras.ts`
are built from it, because Postgres only uses an expression index when the query
repeats the expression exactly. What reaches `to_tsquery` is reduced to letters
and digits first, so a search box can never produce a query that fails to parse.
