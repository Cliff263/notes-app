import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { assertDbConfigured, db } from "@/db/client";
import { users } from "@/db/schema";
import { consumeToken } from "@/lib/auth-tokens";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  assertDbConfigured();

  const limit = rateLimit(`reset:${clientIp(request)}`, LIMITS.reset);
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const userId = await consumeToken(token, "reset");
  if (!userId) {
    return Response.json(
      { error: "That reset link has expired or was already used" },
      { status: 400 },
    );
  }

  await db
    .update(users)
    // Resetting the password also confirms the address, since the link proved
    // the person reading this mailbox controls the account.
    .set({ passwordHash: await hash(password, 10), emailVerified: new Date() })
    .where(eq(users.id, userId));

  return Response.json({ ok: true });
}
