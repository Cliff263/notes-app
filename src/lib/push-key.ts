/**
 * The VAPID public key, on its own.
 *
 * It lives apart from `lib/push.ts` because that module reaches for the
 * database and the signing library, and the browser only needs this one string.
 * Empty when push is not configured, which is how the UI knows to explain
 * itself rather than offering a toggle that cannot work.
 */
export const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
