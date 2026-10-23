import { NextResponse } from "next/server";
import { clientIp, sameOrigin } from "@/lib/request-guards";
import { QUOTE_PDF_SIZE_ZH, QUOTE_PDF_TYPE_ZH } from "@/lib/quote-analysis/copy";
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

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_DECLARED_BYTES) {
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
  const user = await getAuthUser();
  const result = await runQuoteAnalysis({
    userId: user?.id ?? null,
    acknowledged: form.get("acknowledged") === "1",
    mediaType,
    bytes,
    ip: clientIp(req),
    model: (pdf) => completeQuotePdf(pdf),
    store: supabaseQuoteStore,
  });
  return NextResponse.json(result.body, { status: result.status });
}
