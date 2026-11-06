import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { isQuoteAnalysisFlagOn } from "@/lib/quote-analysis/config";
import { supabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie";

/** Pages the proxy must pass through. Keep in step with the proxy matcher. */
export function isAuthSessionPath(path: string): boolean {
  return (
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/login" ||
    path === "/quote/upload" ||
    path.startsWith("/quote/analyses/")
  );
}

/**
 * Quote pages stay reachable with the flag off (they render the closed state).
 * They do not refresh the session then, so a leftover sb- cookie does not call Auth.
 * /account and /login still refresh: account deletion stays available.
 */
export function shouldRefreshAuthSession(path: string): boolean {
  if (path === "/account" || path.startsWith("/account/") || path === "/login") return true;
  if (path === "/quote/upload" || path.startsWith("/quote/analyses/")) {
    return isQuoteAnalysisFlagOn();
  }
  return false;
}

function hasSupabaseCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
}

/**
 * Server Components cannot set cookies, so a token refreshed there is lost.
 * Refresh here and copy the cookies to both the forwarded request and the response.
 * Anonymous visitors (no sb- cookie) never reach Supabase.
 * Quote pages with the flag off do not either, even if an old sb- cookie is present.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (!shouldRefreshAuthSession(path)) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || !hasSupabaseCookie(request)) return response;
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return response;
  }
  const supabase = createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // The page calls getUser() again and treats failure as signed out.
  }
  return response;
}
