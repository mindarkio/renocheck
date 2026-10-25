import { NextResponse } from "next/server";
import { LLMS_TXT } from "@/lib/llms-txt";

/** Public agent card. Not under /api/, so robots.txt allow:/ still covers it. */
export function GET() {
  return new NextResponse(LLMS_TXT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
