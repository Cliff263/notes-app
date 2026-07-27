import { config } from "dotenv";
import { hash } from "bcryptjs";
import { Client } from "pg";
import { configureDatabaseNetworking } from "../src/db/network";
import { buildSeedRows } from "./fixtures";

config({ path: ".env.local" });
configureDatabaseNetworking();

export const TEST_USER = {
  email: "e2e@squarenotes.test",
  password: "e2e-password-123",
  name: "E2E",
};

/**
 * Every run starts from the same test-only workspace. Without this, one spec's
 * bulk action changes what the next spec sees.
 */
export default async function globalSetup() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to run the end-to-end tests");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const existing = await client.query<{ id: string }>(
      'select id from "user" where email = $1',
      [TEST_USER.email],
    );

    let userId = existing.rows[0]?.id;

    if (!userId) {
      const created = await client.query<{ id: string }>(
        'insert into "user" (id, name, email, "passwordHash", "emailVerified", "seededAt") values (gen_random_uuid()::text, $1, $2, $3, now(), now()) returning id',
        [TEST_USER.name, TEST_USER.email, await hash(TEST_USER.password, 10)],
      );
      userId = created.rows[0].id;
    } else {
      // Keep the password in step in case it is ever changed by a spec.
      await client.query('update "user" set "passwordHash" = $1 where id = $2', [
        await hash(TEST_USER.password, 10),
        userId,
      ]);
    }

    await client.query('delete from event where "userId" = $1', [userId]);
    await client.query('delete from note where "userId" = $1', [userId]);
    await client.query('delete from "authToken" where "userId" = $1', [userId]);

    const { noteRows, eventRows } = buildSeedRows(userId);

    for (const note of noteRows) {
      await client.query(
        'insert into note (id, "userId", title, content, category, tags, pinned, favorite, archived, "createdAt", "updatedAt") values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          note.userId,
          note.title,
          note.content,
          note.category,
          note.tags,
          note.pinned,
          note.favorite,
          note.archived,
          note.createdAt,
          note.updatedAt,
        ],
      );
    }

    for (const event of eventRows) {
      await client.query(
        'insert into event (id, "userId", title, description, location, "startsAt", "endsAt", "allDay", color, recurrence) values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          event.userId,
          event.title,
          event.description,
          event.location,
          event.startsAt,
          event.endsAt,
          event.allDay,
          event.color,
          event.recurrence,
        ],
      );
    }
  } finally {
    await client.end();
  }
}
