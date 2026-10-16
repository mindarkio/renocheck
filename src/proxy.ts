import { NextResponse, type NextRequest } from "next/server";

/** buildSearchFingerprint → sha256 hex sliced to 32 chars. */
const REPORT_PATH_RE = /^\/report\/[0-9a-f]{32}\/?$/;

/** Return a real 404 status for malformed /report/* URLs (page is PPR-streamed, so notFound() alone yields 200). */
export function proxy(request: NextRequest) {
  if (!REPORT_PATH_RE.test(request.nextUrl.pathname)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/report/:path*"],
};
