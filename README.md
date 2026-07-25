# Square Notes

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
- Search across title, content and tags in one pass
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
| `/calendar` | Month view and what's upcoming |
| `/settings` | Profile, appearance, export, account |

A new note inherits the view you create it from — from `/category/work` it lands
in Work, from `/tags/react` it arrives already tagged `#react`.

**Writing**

- Markdown with a formatting toolbar, a Write/Preview toggle, and lists that
  continue when you press Enter
- Headings, lists, quotes, code and emphasis render in the preview and carry
  through to PDF and Word exports

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

- Month grid with a glowing "today" cell over a faint grid backdrop
- Coloured event pills; click one to edit, double-click a day to add one
- A side panel with the selected day's schedule and what's coming next, labelled
  "Today", "Tomorrow", "in 3 days" and so on

**Account**

- Email/password sign-up, or Google if you configure it
- A new account is seeded with a full set of notes and events, so it never opens empty
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

Leave the Google variables unset and the "Continue with Google" button simply
doesn't render — email/password still works.

For Google sign-in, add `http://localhost:3000/api/auth/callback/google` as an
authorized redirect URI on the OAuth client (and your production URL when you deploy).

### 3. Create the tables

```bash
npm run db:push
```

Run this again after pulling changes that add columns — `notes.deletedAt`,
`notes.dueAt` and `events.noteId` were added for trash, due dates and
note-to-event links. All three are nullable, so the migration is additive.

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
| `npm run db:generate` | Generate SQL migration files |
| `npm run db:studio` | Drizzle Studio |

## Running against a local Postgres

Neon is the target, but any Postgres works for local development — the driver is
chosen from the host in `DATABASE_URL`. A non-Neon host uses `node-postgres`
instead of Neon's HTTP driver, so this is enough:

```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/notes"
```

Then `npm run db:push` as usual.

## How it's organised

```
src/
  app/
    (auth)/login, (auth)/signup   Sign-in and sign-up screens
    api/                          Route handlers for notes, events, account, auth, export
    favorites/, pinned/, archive/ Note views
    category/[category]/          One view per category
    tags/, tags/[tag]/            Tag index and per-tag view
    calendar/                     Calendar page
    settings/                     Account, appearance and export
    page.tsx                      All notes
  components/
    auth/                         Auth shell and form
    calendar/                     Month grid, upcoming panel, event modal
    notes/                        Note cards, list pane, editor
    sidebar.tsx                   Shared navigation
    workspace.tsx                 The three-pane shell each note route renders
  db/                             Drizzle schema, client, seed data
  store/                          Zustand stores for notes and events
  lib/                            Types, routes, formatting, export builders, session guard
  auth.ts, auth.config.ts         Auth.js configuration
  proxy.ts                        Route protection (Next 16's middleware)
```

Every note and event row carries a `userId`, and each API route resolves the user
from the session before it touches the database — a request can only ever read or
write its own rows.
