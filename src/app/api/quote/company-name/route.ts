import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request-guards";
import { saveQuoteCompanyNames } from "@/lib/quote-analysis/company-names";
import { QUOTE_AUTH_REQUIRED_ZH, QUOTE_FAILED_ZH } from "@/lib/quote-analysis/copy";
import { normalizeQuoteCompanyName } from "@/lib/quote-analysis/schema";
import { getAuthUser } from "@/lib/supabase/server";

export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stores the confirmed company name for the signed-in owner. Missing columns are ignored. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: QUOTE_AUTH_REQUIRED_ZH },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input", message: QUOTE_FAILED_ZH }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const analysisId = typeof record.analysisId === "string" ? record.analysisId : "";
  if (!UUID_RE.test(analysisId)) {
    return NextResponse.json({ error: "invalid_input", message: QUOTE_FAILED_ZH }, { status: 400 });
  }
  const companyName = normalizeQuoteCompanyName(record.companyName);
  await saveQuoteCompanyNames({
    analysisId,
    userId: user.id,
    confirmed: companyName,
  });
  return NextResponse.json({ ok: true });
}
