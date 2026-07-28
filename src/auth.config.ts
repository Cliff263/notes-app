import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import {
  SESSION_IDLE_MAX_AGE_SECONDS,
  SESSION_REFRESH_SECONDS,
} from "@/lib/session-policy";

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

// `/s/` is excluded by the proxy matcher too; listed here so that a shared note
// stays reachable even if that matcher is ever loosened.
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot", "/reset", "/verify", "/s/"];

/**
 * Edge-safe half of the Auth.js setup: no database adapter and no bcrypt, so it
 * can run inside `proxy.ts`. The full config in `auth.ts` extends this.
 */
export const authConfig = {
  providers: googleEnabled
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  session: {
    strategy: "jwt",
    maxAge: SESSION_IDLE_MAX_AGE_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
  },
  pages: { signIn: "/login", error: "/login" },
  /*
   * Without this, Auth.js refuses to run behind any host it can't verify and
   * every production sign-in fails with `error=Configuration`. Vercel sets the
   * host itself; self-hosting (or `next start` locally) needs it stated.
   */
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

      if (isPublic) {
        // A signed-in visitor following a reset or confirmation link should
        // still land on that page rather than being bounced to the workspace.
        const isEntry = pathname === "/login" || pathname === "/signup";
        if (signedIn && isEntry) return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }

      return signedIn;
    },
    jwt({ token, user, trigger, session }) {
      if (user?.id) token.sub = user.id;
      if (
        trigger === "update" &&
        typeof session?.user?.name === "string"
      ) {
        token.name = session.user.name.trim().slice(0, 80);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
