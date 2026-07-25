import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { assertDbConfigured, db } from "@/db/client";
import { users } from "@/db/schema";
import { seedWorkspace } from "@/db/seed-user";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  assertDbConfigured();

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");

  if (!EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return Response.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({
      name: name || email.split("@")[0],
      email,
      passwordHash,
    })
    .returning({ id: users.id });

  await seedWorkspace(created.id);

  return Response.json({ ok: true }, { status: 201 });
}
