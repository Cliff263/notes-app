/** Refresh active rolling sessions every 15 minutes. */
export const SESSION_REFRESH_SECONDS = 15 * 60;

/**
 * A refresh extends the encrypted HTTP-only session cookie from this window.
 * Users who stay inactive for the full period must sign in again.
 */
export const SESSION_IDLE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
