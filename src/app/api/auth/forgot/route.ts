import { eq } from "drizzle-orm";
import { assertDbConfigured, db } from "@/db/client";
import { users } from "@/db/schema";
import { appUrl, issueToken } from "@/lib/auth-tokens";
import { resetPasswordEmail, sendEmail } from "@/lib/email";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Always answers 200, whether or not the address exists — otherwise this
 * endpoint would confirm which emails have accounts.
 */
export async function POST(request: Request) {
  assertDbConfigured();

  const limit = rateLimit(`forgot:${clientIp(request)}`, LIMITS.forgot);
  if (!limit.ok) return tooManyRequests(limit);

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();

  const ok = Response.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });

  if (!email) return ok;

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Google-only accounts have no password to reset.
  if (!user?.passwordHash) return ok;

  const token = await issueToken(user.id, "reset");
  const link = `${appUrl()}/reset/${token}`;
  const message = resetPasswordEmail(link);

  await sendEmail({ to: email, ...message });
  return ok;
}
