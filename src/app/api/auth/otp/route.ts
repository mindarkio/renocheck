import { NextResponse } from "next/server";
import { logAuthOtpSendFailed, logAuthRouteUnavailable } from "@/lib/auth/diagnostics";
import { normalizeLoginEmail } from "@/lib/auth/email";
import { rateLimitIp, takeAuthRateLimit } from "@/lib/auth/rate-limit";
import { isQuoteAnalysisFlagOn } from "@/lib/quote-analysis/config";
import { clientIp, sameOrigin } from "@/lib/request-guards";
import {
  LOGIN_EMAIL_INVALID_ZH,
  LOGIN_SEND_FAILED_ZH,
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
  if (!isQuoteAnalysisFlagOn()) {
    logAuthRouteUnavailable("otp", "flag_off");
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }
  if (!isSupabaseAuthConfigured()) {
    logAuthRouteUnavailable("otp", "auth_unconfigured");
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
      { error: "invalid_input", message: LOGIN_EMAIL_INVALID_ZH },
      { status: 400 },
    );
  }
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = normalizeLoginEmail(record.email);
  if (!email) {
    return NextResponse.json(
      { error: "invalid_input", message: LOGIN_EMAIL_INVALID_ZH },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  const ipLimit = await takeAuthRateLimit({
    key: `otp-ip:${rateLimitIp(ip)}`,
    limit: 5,
    windowMs: FIFTEEN_MINUTES,
  });
  if (ipLimit === "unavailable") {
    logAuthRouteUnavailable("otp", "ip_rate_limit");
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
    key: `otp-email:${email}`,
    limit: 3,
    windowMs: FIFTEEN_MINUTES,
  });
  if (emailLimit === "unavailable") {
    logAuthRouteUnavailable("otp", "email_rate_limit");
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
    logAuthRouteUnavailable("otp", "no_server_client");
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_UNAVAILABLE_ZH },
      { status: 503 },
    );
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    logAuthOtpSendFailed(error);
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_SEND_FAILED_ZH },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
