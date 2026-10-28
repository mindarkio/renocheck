import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isQuoteUploadOpen } from "@/lib/quote-analysis/availability";

export const instant = false;

export async function GET() {
  await connection();
  const enabled = await isQuoteUploadOpen();
  return NextResponse.json({
    enabled,
    anonymous: enabled,
  });
}
