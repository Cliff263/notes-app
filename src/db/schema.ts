import {
  boolean,
  customType,
  index,
  type AnyPgColumn,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Binary columns, carried over the wire in Postgres' hex format rather than as
 * a driver-native buffer. Neon speaks HTTP and node-postgres speaks the wire
 * protocol, and they disagree about what a `bytea` looks like in JavaScript;
 * the hex form is what both of them accept and return without argument.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType: () => "bytea",
  toDriver: (value) => `\\x${value.toString("hex")}`,
  fromDriver: (value) =>
    typeof value === "string"
      ? Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex")
      : value,
});

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

/**
 * Password resets and email confirmations. Only a hash of the token is stored,
 * so a leaked database row cannot be replayed as a link, and `usedAt` makes
 * every token single-use.
 */
export const authTokens = pgTable(
  "authToken",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"reset" | "verify">().notNull(),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date", withTimezone: true }).notNull(),
    usedAt: timestamp("usedAt", { mode: "date", withTimezone: true }),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("authToken_hash_idx").on(t.tokenHash)],
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

/**
 * A snapshot of a note as it was before an edit. Written by the note's own
 * PATCH route rather than a trigger, so the decision about *when* a change is
 * worth keeping lives next to the code that knows what changed.
 */
export const noteVersions = pgTable(
  "noteVersion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("noteId")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("noteVersion_note_idx").on(t.noteId, t.createdAt)],
);

/**
 * A public link to one note.
 *
 * The token is stored as it appears in the URL, unlike the reset tokens above:
 * those grant access to an account and are never shown twice, while this one is
 * a link the owner is meant to be able to copy again tomorrow. Revoking deletes
 * the row, so a withdrawn link stops working immediately.
 */
export const noteShares = pgTable(
  "noteShare",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("noteId")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    /** Reserved for collaborative editing; the public page is read-only. */
    allowEdit: boolean("allowEdit").notNull().default(false),
    expiresAt: timestamp("expiresAt", { mode: "date", withTimezone: true }),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("noteShare_token_idx").on(t.token),
    // One link per note: sharing is a state the note is in, not a list.
    uniqueIndex("noteShare_note_idx").on(t.noteId),
  ],
);

/** Files pasted or dropped into a note, kept in the database as bytes. */
export const attachments = pgTable(
  "attachment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("noteId")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attachment_note_idx").on(t.noteId)],
);

export type DbNote = typeof notes.$inferSelect;
export type DbEvent = typeof events.$inferSelect;
export type DbUser = typeof users.$inferSelect;
export type DbNoteVersion = typeof noteVersions.$inferSelect;
export type DbNoteShare = typeof noteShares.$inferSelect;
export type DbAttachment = typeof attachments.$inferSelect;
