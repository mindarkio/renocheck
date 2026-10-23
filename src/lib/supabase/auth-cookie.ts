/**
 * There is no browser Supabase client, so the session cookie can be httpOnly.
 * Other defaults (path, sameSite, maxAge) stay with the SSR library.
 */
export const SUPABASE_AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
} as const;
