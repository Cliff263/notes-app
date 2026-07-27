import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Next 16's replacement for `middleware.ts`. Uses the trimmed auth config so no
 * database driver is pulled in here — the `authorized` callback only needs to
 * read the session cookie.
 */
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Page routes only. API routes answer 401 themselves so a fetch never
    // follows a redirect into an HTML sign-in page, and `/s/…` is a shared note,
    // whose whole point is that a signed-out reader can open it.
    "/((?!api|s/|icons/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:webmanifest|svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
