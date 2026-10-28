import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isQuoteUploadOpen } from "@/lib/quote-analysis/availability";

export const instant = false;

export async function GET() {
  await connection();
  return NextResponse.json({ enabled: await isQuoteUploadOpen() });
}
