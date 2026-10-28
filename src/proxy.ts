import { NextResponse, type NextRequest } from "next/server";
import { GUIDES } from "@/lib/guides";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  getAdminEnvPin,
  verifySessionToken,
} from "@/lib/admin/auth";
import {
  isAuthSessionPath,
  refreshSupabaseSession,
} from "@/lib/supabase/proxy-session";

const GUIDE_PATHS = new Set(GUIDES.map((g) => `/guides/${g.slug}`));

/** buildSearchFingerprint → sha256 hex sliced to 32 chars. */
const REPORT_PATH_RE = /^\/report\/[0-9a-f]{32}\/?$/;

/** Real 404 status for malformed /report/* and unknown /guides/* URLs (page is PPR-streamed, so notFound() alone yields 200). */
function notFoundResponse() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
    },
  });
}

/** /admin is streamed too, so notFound()/redirect() in the page would still answer 200. Gate it here. */
function adminGate(request: NextRequest, path: string): NextResponse {
  const config = getAdminAuthConfig();
  const pin = getAdminEnvPin();
  if (!config || !pin) return notFoundResponse();
  if (path === "/admin/login") return NextResponse.next();
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifySessionToken(token, config, pin, Date.now())) {
    const res = NextResponse.redirect(new URL("/admin/login", request.url), 307);
    res.headers.set("cache-control", "no-store");
    res.headers.set("x-robots-tag", "noindex, nofollow");
    return res;
  }
  return NextResponse.next();
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname.replace(/\/$/, "");
  if (isAuthSessionPath(path)) {
    return refreshSupabaseSession(request);
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    return adminGate(request, path);
  }
  if (path.startsWith("/guides/")) {
    return GUIDE_PATHS.has(path) ? NextResponse.next() : notFoundResponse();
  }
  if (!REPORT_PATH_RE.test(request.nextUrl.pathname)) {
    return notFoundResponse();
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/report/:path*",
    "/guides/:path+",
    "/admin",
    "/admin/:path*",
    "/account",
    "/account/:path*",
    "/login",
    "/quote/upload",
    "/quote/analyses/:path*",
  ],
};
