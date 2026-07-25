import {
  boolean,
  index,
  type AnyPgColumn,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* -------------------------------------------------------------------------- */
/*  Auth.js tables                                                            */
/* -------------------------------------------------------------------------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
  /** null for OAuth-only accounts */
  passwordHash: text("passwordHash"),
  seededAt: timestamp("seededAt", { mode: "date", withTimezone: true }),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* -------------------------------------------------------------------------- */
/*  App tables                                                                */
/* -------------------------------------------------------------------------- */

export const notes = pgTable(
  "note",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled note"),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("Personal"),
    tags: text("tags").array().notNull().default([]),
    pinned: boolean("pinned").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    /** Set when the note is in the trash; cleared on restore. */
    deletedAt: timestamp("deletedAt", { mode: "date", withTimezone: true }),
    /** Optional due date, shown in the calendar and the upcoming panel. */
    dueAt: timestamp("dueAt", { mode: "date", withTimezone: true }),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("note_user_idx").on(t.userId)],
);

export const events = pgTable(
  "event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    startsAt: timestamp("startsAt", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("endsAt", { mode: "date", withTimezone: true }).notNull(),
    allDay: boolean("allDay").notNull().default(false),
    color: text("color").notNull().default("violet"),
    /** Optional link back to the note this event came from. */
    noteId: text("noteId").references((): AnyPgColumn => notes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("event_user_idx").on(t.userId), index("event_start_idx").on(t.startsAt)],
);

export type DbNote = typeof notes.$inferSelect;
export type DbEvent = typeof events.$inferSelect;
export type DbUser = typeof users.$inferSelect;
