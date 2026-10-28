import { NextResponse } from "next/server";
import { clientIp, sameOrigin } from "@/lib/request-guards";
import { isQuoteAnalysisAvailable } from "@/lib/quote-analysis/config";
import { saveQuoteCompanyNames } from "@/lib/quote-analysis/company-names";
import {
  QUOTE_PDF_SIZE_ZH,
  QUOTE_PDF_TYPE_ZH,
  QUOTE_UNAVAILABLE_API_ZH,
} from "@/lib/quote-analysis/copy";
import { runAnonymousQuoteAnalysis } from "@/lib/quote-analysis/anonymous-run";
import { completeQuotePdf, extractQuoteCompanyName } from "@/lib/quote-analysis/provider";
import { runQuoteAnalysis } from "@/lib/quote-analysis/run";
import { normalizeQuoteCompanyName } from "@/lib/quote-analysis/schema";
import { supabaseQuoteStore } from "@/lib/quote-analysis/store";
import { getAuthUser } from "@/lib/supabase/server";

export const maxDuration = 60;
export const instant = false;

const MAX_DECLARED_BYTES = 4_500_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Flag and session first, so a disabled or anonymous caller never gets its body parsed.
  if (!isQuoteAnalysisAvailable()) {
    return NextResponse.json(
      { error: "quote_unavailable", message: QUOTE_UNAVAILABLE_API_ZH },
      { status: 503 },
    );
  }
  const user = await getAuthUser();

  // Vercel also caps request bodies at 4.5 MB before the function runs.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared > MAX_DECLARED_BYTES) {
    return NextResponse.json(
      { error: "invalid_pdf", message: QUOTE_PDF_SIZE_ZH },
      { status: 413 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "invalid_pdf", message: QUOTE_PDF_TYPE_ZH },
      { status: 415 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_pdf", message: QUOTE_PDF_TYPE_ZH },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const bytes =
    file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null;
  const mediaType = file instanceof File ? file.type : "";
  const acknowledged = form.get("acknowledged") === "1";
  const ip = clientIp(req);
  if (!user) {
    const anonymous = await runAnonymousQuoteAnalysis({
      acknowledged,
      mediaType,
      bytes,
      ip,
      model: (pdf) => extractQuoteCompanyName(pdf),
    });
    return NextResponse.json(anonymous.body, { status: anonymous.status });
  }
  const result = await runQuoteAnalysis({
    userId: user.id,
    acknowledged,
    mediaType,
    bytes,
    ip,
    model: (pdf) => completeQuotePdf(pdf),
    store: supabaseQuoteStore,
  });
  if (result.status === 200 && result.body.id) {
    const extractedField = form.get("extractedCompanyName");
    const confirmedField = form.get("confirmedCompanyName");
    await saveQuoteCompanyNames({
      analysisId: result.body.id,
      userId: user.id,
      extracted:
        typeof extractedField === "string"
          ? extractedField
          : (result.body.companyName ?? null),
      ...(typeof confirmedField === "string"
        ? { confirmed: normalizeQuoteCompanyName(confirmedField) }
        : {}),
    });
  }
  return NextResponse.json(result.body, { status: result.status });
}
