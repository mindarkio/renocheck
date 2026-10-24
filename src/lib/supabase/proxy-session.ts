import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { supabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie";

/** Pages that read the Supabase session. Keep in step with the proxy matcher. */
export function isAuthSessionPath(path: string): boolean {
  return (
    path === "/account" ||
    path === "/login" ||
    path === "/quote/upload" ||
    path.startsWith("/quote/analyses/")
  );
}

function hasSupabaseCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"));
}

/**
 * Server Components cannot set cookies, so a token refreshed there is lost.
 * Refresh here and copy the cookies to both the forwarded request and the response.
 * Anonymous visitors (no sb- cookie) never reach Supabase.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
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
