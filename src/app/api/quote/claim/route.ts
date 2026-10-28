import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request-guards";
import { claimSealedQuote } from "@/lib/quote-analysis/claim";
import { QUOTE_AUTH_REQUIRED_ZH, QUOTE_FAILED_ZH } from "@/lib/quote-analysis/copy";
import { getAuthUser } from "@/lib/supabase/server";

export const instant = false;

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
    return NextResponse.json({ error: "seal_invalid", message: QUOTE_FAILED_ZH }, { status: 400 });
  }
  const sealed =
    body && typeof body === "object" ? (body as { sealed?: unknown }).sealed : null;
  if (typeof sealed !== "string" || sealed.length === 0 || sealed.length > 200_000) {
    return NextResponse.json({ error: "seal_invalid", message: QUOTE_FAILED_ZH }, { status: 400 });
  }
  const result = await claimSealedQuote({ userId: user.id, sealed });
  return NextResponse.json(result.body, { status: result.status });
}
