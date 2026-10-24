import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCachedReport } from "@/lib/search-cache";
import { redactReportForPublicResponse } from "@/lib/redact-public-report";
import { riskReportSchema } from "@/lib/report-schema";

type RouteContext = { params: Promise<{ fingerprint: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { fingerprint } = await context.params;
  if (!fingerprint || fingerprint.length < 16) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const cached = await getCachedReport(supabase, fingerprint);
  if (!cached) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = riskReportSchema.safeParse(cached);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_report" }, { status: 500 });
  }

  return NextResponse.json({
    fingerprint,
    report: redactReportForPublicResponse(parsed.data),
  });
}
