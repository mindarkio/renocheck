import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isQuoteUploadOpen } from "@/lib/quote-analysis/availability";
import { quoteSealKey } from "@/lib/quote-analysis/seal";

export const instant = false;

export async function GET() {
  await connection();
  const enabled = await isQuoteUploadOpen();
  return NextResponse.json({
    enabled,
    anonymous: enabled && quoteSealKey() !== null,
  });
}
