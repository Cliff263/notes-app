import { eq } from "drizzle-orm";
import { assertDbConfigured, db } from "@/db/client";
import { users } from "@/db/schema";
import { appUrl, consumeToken, issueToken } from "@/lib/auth-tokens";
import { sendEmail, verifyEmailEmail } from "@/lib/email";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

/** Consumes a confirmation link. */
export async function GET(request: Request) {
  assertDbConfigured();

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = await consumeToken(token, "verify");

  if (!userId) {
    return Response.json(
      { error: "That confirmation link has expired or was already used" },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, userId));

  return Response.json({ ok: true });
}

/** Sends (or resends) the confirmation link to the signed-in address. */
export async function POST(request: Request) {
  try {
    assertDbConfigured();

    const limit = rateLimit(`verify:${clientIp(request)}`, LIMITS.forgot);
    if (!limit.ok) return tooManyRequests(limit);

    const userId = await requireUserId();
    const [user] = await db
      .select({ email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return Response.json({ error: "Account not found" }, { status: 404 });
    if (user.emailVerified) return Response.json({ ok: true, alreadyVerified: true });

    const token = await issueToken(userId, "verify");
    await sendEmail({
      to: user.email,
      ...verifyEmailEmail(`${appUrl()}/verify/${token}`),
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
