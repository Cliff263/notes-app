import { auth } from "@/auth";
import { assertDbConfigured } from "@/db/client";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/** Returns the signed-in user's id, or throws so routes can answer 401. */
export async function requireUserId() {
  assertDbConfigured();
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
