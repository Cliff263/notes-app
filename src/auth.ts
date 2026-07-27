import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "./db/client";
import { accounts, sessions, users, verificationTokens } from "./db/schema";
import { clientIp, LIMITS, rateLimit } from "./lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Guessing one account is capped tightly; a shared address is capped
        // loosely, so an office or a test run is not locked out by volume.
        const ip = request instanceof Request ? clientIp(request) : "unknown";
        const throttled =
          !rateLimit(`signin:email:${email}`, LIMITS.signIn).ok ||
          !rateLimit(`signin:ip:${ip}`, LIMITS.signInPerIp).ok;

        if (throttled) {
          throw new Error("Too many sign-in attempts. Please wait a few minutes.");
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;
        if (!(await compare(password, user.passwordHash))) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
});
