import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const PUBLIC_ROUTES = ["/login", "/signup"];

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
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

      if (isPublic) {
        if (signedIn) return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }

      return signedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
