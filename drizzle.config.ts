import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { configureDatabaseNetworking } from "./src/db/network";

config({ path: ".env.local" });
configureDatabaseNetworking();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
  strict: true,
  verbose: true,
});
