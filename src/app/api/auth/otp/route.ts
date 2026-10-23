import { NextResponse } from "next/server";
import { normalizeLoginEmail } from "@/lib/auth/email";
import { takeMemoryRateLimit } from "@/lib/memory-rate-limit";
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
  const now = Date.now();
  if (
    !takeMemoryRateLimit(`otp-ip:${ip}`, 5, FIFTEEN_MINUTES, now) ||
    !takeMemoryRateLimit(`otp-email:${email}`, 3, FIFTEEN_MINUTES, now)
  ) {
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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return NextResponse.json(
      { error: "unavailable", message: LOGIN_SEND_FAILED_ZH },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
