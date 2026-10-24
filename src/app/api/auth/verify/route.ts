import { NextResponse } from "next/server";
import { isSixDigitCode, normalizeLoginEmail } from "@/lib/auth/email";
import { takeAuthRateLimit } from "@/lib/auth/rate-limit";
import { isQuoteAnalysisFlagOn } from "@/lib/quote-analysis/config";
import { clientIp, sameOrigin } from "@/lib/request-guards";
import {
  LOGIN_CODE_INVALID_ZH,
  LOGIN_UNAVAILABLE_ZH,
  QUOTE_RATE_LIMIT_ZH,
} from "@/lib/quote-analysis/copy";
import {
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";

const FIFTEEN_MINUTES = 15 * 60_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isQuoteAnalysisFlagOn() || !isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_input", message: LOGIN_CODE_INVALID_ZH },
      { status: 400 },
    );
  }
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = normalizeLoginEmail(record.email);
  const token = record.token;
  if (!email || !isSixDigitCode(token)) {
    return NextResponse.json(
      { error: "invalid_input", message: LOGIN_CODE_INVALID_ZH },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const ipLimit = await takeAuthRateLimit({
    key: `otp-verify-ip:${ip}`,
    limit: 10,
    windowMs: FIFTEEN_MINUTES,
  });
  if (ipLimit === "unavailable") {
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }
  if (ipLimit === "limited") {
    return NextResponse.json(
      { error: "rate_limited", message: QUOTE_RATE_LIMIT_ZH },
      { status: 429 },
    );
  }
  const emailLimit = await takeAuthRateLimit({
    key: `otp-verify-email:${email}`,
    limit: 8,
    windowMs: FIFTEEN_MINUTES,
  });
  if (emailLimit === "unavailable") {
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }
  if (emailLimit === "limited") {
    return NextResponse.json(
      { error: "rate_limited", message: QUOTE_RATE_LIMIT_ZH },
      { status: 429 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return NextResponse.json(
      { error: "invalid_code", message: LOGIN_CODE_INVALID_ZH },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
