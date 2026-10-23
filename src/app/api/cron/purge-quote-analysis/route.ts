import { NextResponse } from "next/server";
import { cronAuth } from "@/lib/cron-auth";
import { purgeQuoteAnalysisRetention } from "@/lib/quote-analysis/retention-store";

/** Daily at 18:25 UTC (vercel.json). Counts only; never log a user id. */
export async function GET(req: Request) {
  const auth = cronAuth(req);
  if (auth === "missing") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (auth === "denied") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeQuoteAnalysisRetention();
    if (!result.ok) {
      console.warn(
        JSON.stringify({ event: "quote_analysis_purge_failed", code: result.code }),
      );
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    console.info(
      JSON.stringify({
        event: "quote_analysis_purge",
        analysesDeleted: result.analysesDeleted,
        claimsDeleted: result.claimsDeleted,
        spendRowsDeleted: result.spendRowsDeleted,
        pending: result.pending,
      }),
    );
    return NextResponse.json(
      {
        ok: true,
        analysesDeleted: result.analysesDeleted,
        claimsDeleted: result.claimsDeleted,
        spendRowsDeleted: result.spendRowsDeleted,
        pending: result.pending,
      },
      { status: 200 },
    );
  } catch {
    console.warn(JSON.stringify({ event: "quote_analysis_purge_failed", code: "threw" }));
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
