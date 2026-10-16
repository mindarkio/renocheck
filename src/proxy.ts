import { NextResponse, type NextRequest } from "next/server";
import { GUIDES } from "@/lib/guides";

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

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "");
  if (path.startsWith("/guides/")) {
    return GUIDE_PATHS.has(path) ? NextResponse.next() : notFoundResponse();
  }
  if (!REPORT_PATH_RE.test(request.nextUrl.pathname)) {
    return notFoundResponse();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/report/:path*", "/guides/:path+"],
};
