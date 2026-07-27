import { config } from "dotenv";
import { Client } from "pg";
import { configureDatabaseNetworking } from "../src/db/network";
import { SEARCH_VECTOR } from "../src/lib/search";

config({ path: ".env.local" });
configureDatabaseNetworking();

/**
 * Everything `drizzle-kit push` cannot express. Right now that is one thing:
 * the GIN index behind full-text search, which is built over an expression
 * rather than a column.
 *
 * Because the index is not in the Drizzle schema, `drizzle-kit push` sees it as
 * something it did not create and offers to drop it. That is why `npm run
 * db:push` runs this straight afterwards: whichever way that prompt is
 * answered, the index is back by the time the command finishes.
 *
 * The expression comes from `src/lib/search.ts` — the same constant the query
 * uses — because Postgres only reaches for an expression index when the query
 * repeats the expression exactly. Generating the statement from that constant
 * is what stops the two drifting apart.
 *
 * Safe to run repeatedly, and safe to skip: search returns identical rows
 * without the index, it just scans to find them.
 */
const STATEMENTS = [
  {
    label: "note_search_idx (full-text search)",
    sql: `create index if not exists note_search_idx on "note" using gin ((${SEARCH_VECTOR}))`,
  },
];

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Put your connection string in .env.local — see README.md.",
    );
  }

  // node-postgres speaks the wire protocol, which Neon's pooled endpoint also
  // accepts, so one client covers both local Postgres and production.
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const statement of STATEMENTS) {
      process.stdout.write(`  ${statement.label} … `);
      await client.query(statement.sql);
      process.stdout.write("ok\n");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
