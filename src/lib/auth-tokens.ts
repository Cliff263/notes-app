import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { authTokens } from "@/db/schema";

const TTL = {
  reset: 60 * 60_000, // one hour
  verify: 24 * 60 * 60_000, // a day
} as const;

/** Tokens are compared by hash, never stored in the clear. */
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(userId: string, kind: "reset" | "verify") {
  const token = randomBytes(32).toString("base64url");

  await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TTL[kind]),
  });

  return token;
}

/**
 * Returns the owning user id and burns the token, or null if it is unknown,
 * expired or already spent.
 */
export async function consumeToken(token: string, kind: "reset" | "verify") {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hash(token)),
        eq(authTokens.kind, kind),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));

  return row.userId;
}

export function appUrl() {
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (vercelHost ? `https://${vercelHost}` : undefined) ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
