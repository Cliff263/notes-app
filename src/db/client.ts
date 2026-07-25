import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(connectionString);

/**
 * Neon speaks HTTP, a plain Postgres server speaks the wire protocol, so the
 * driver is picked from the host. Production uses Neon; the node-postgres path
 * is there so the app can run against a local Postgres during development.
 */
const useNeon = !connectionString || /neon\.(tech|build)/.test(connectionString);

const PLACEHOLDER = "postgresql://user:password@localhost/placeholder";

/**
 * Nothing connects here — both drivers build their client lazily — so the
 * placeholder keeps `next build` working without credentials. Requests are
 * guarded by `assertDbConfigured`. This cannot be wrapped in a lazy Proxy: the
 * Auth.js Drizzle adapter inspects the instance to detect the SQL dialect.
 */
export const db = useNeon
  ? drizzleNeon(neon(connectionString ?? PLACEHOLDER), { schema })
  : (drizzlePg(connectionString!, { schema }) as unknown as ReturnType<
      typeof drizzleNeon<typeof schema>
    >);

export function assertDbConfigured() {
  if (!isDbConfigured) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon database and put its connection string in .env.local — see README.md.",
    );
  }
}

export { schema };
