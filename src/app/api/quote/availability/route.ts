import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isQuoteAnalysisAvailable } from "@/lib/quote-analysis/config";

export const instant = false;

export async function GET() {
  await connection();
  return NextResponse.json({ enabled: isQuoteAnalysisAvailable() });
}
