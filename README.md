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
- Pin and favorite, with dedicated sidebar views for each
- Filter by category (Personal, Work, Ideas, Journal, Archive) or by tag
- Search across title, content and tags in one pass
- Grid or list layout, dark or light theme

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
    api/                          Route handlers for notes, events, account, auth
    calendar/                     Calendar page
    settings/                     Account and appearance settings
    page.tsx                      The notes workspace
  components/
    auth/                         Auth shell and form
    calendar/                     Month grid, upcoming panel, event modal
    notes/                        Note cards, list pane, editor
    sidebar.tsx                   Shared navigation
  db/                             Drizzle schema, client, seed data
  store/                          Zustand stores for notes and events
  lib/                            Types, formatting helpers, session guard
  auth.ts, auth.config.ts         Auth.js configuration
  proxy.ts                        Route protection (Next 16's middleware)
```

Every note and event row carries a `userId`, and each API route resolves the user
from the session before it touches the database — a request can only ever read or
write its own rows.
