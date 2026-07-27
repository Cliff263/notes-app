import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.VERCEL
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

export const isDbConfigured = Boolean(connectionString);

const PLACEHOLDER = "postgresql://user:password@localhost/placeholder";

/**
 * Vercel's Neon integration supplies a pooled Postgres URL, so configured
 * environments use node-postgres. This also avoids depending on Neon's HTTP
 * fetch transport during local development. Nothing connects at construction
 * time.
 *
 * Without credentials, the HTTP placeholder keeps `next build` working.
 * Requests are guarded by `assertDbConfigured`. This cannot be wrapped in a
 * lazy Proxy: the Auth.js Drizzle adapter inspects the instance to detect the
 * SQL dialect.
 */
export const db = connectionString
  ? (drizzlePg(connectionString, { schema }) as unknown as ReturnType<
      typeof drizzleNeon<typeof schema>
    >)
  : drizzleNeon(neon(PLACEHOLDER), { schema });

export function assertDbConfigured() {
  if (!isDbConfigured) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon database and put its connection string in .env.local — see README.md.",
    );
  }
}

export { schema };
