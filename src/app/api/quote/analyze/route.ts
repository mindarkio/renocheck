import { NextResponse } from "next/server";
import { clientIp, sameOrigin } from "@/lib/request-guards";
import { isQuoteAnalysisAvailable } from "@/lib/quote-analysis/config";
import {
  QUOTE_AUTH_REQUIRED_ZH,
  QUOTE_PDF_SIZE_ZH,
  QUOTE_PDF_TYPE_ZH,
  QUOTE_UNAVAILABLE_API_ZH,
} from "@/lib/quote-analysis/copy";
import { completeQuotePdf } from "@/lib/quote-analysis/provider";
import { runQuoteAnalysis } from "@/lib/quote-analysis/run";
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
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: QUOTE_AUTH_REQUIRED_ZH },
      { status: 401 },
    );
  }

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
  const result = await runQuoteAnalysis({
    userId: user.id,
    acknowledged: form.get("acknowledged") === "1",
    mediaType,
    bytes,
    ip: clientIp(req),
    model: (pdf) => completeQuotePdf(pdf),
    store: supabaseQuoteStore,
  });
  return NextResponse.json(result.body, { status: result.status });
}
