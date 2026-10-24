/**
 * There is no browser Supabase client, so the session cookie can be httpOnly.
 * Secure is set only when NODE_ENV is production, so localhost dev still
 * accepts the cookie. Other defaults (path, sameSite, maxAge) stay with the SSR library.
 */
export function supabaseAuthCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): { httpOnly: true; secure: boolean } {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
  };
}
