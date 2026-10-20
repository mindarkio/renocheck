import { NextResponse } from "next/server";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  readDeviceIdFromCookieHeader,
} from "@/lib/device-id";
import { isFeedbackEnabled, quoteHashSecret } from "@/lib/feedback/config";
import { logFeedback } from "@/lib/feedback/log";
import { checkFeedbackRateLimit } from "@/lib/feedback/rate-limit";
import { feedbackBodySchema } from "@/lib/feedback/schema";
import { submitCompanyReportFeedback } from "@/lib/feedback/store";

const MAX_BODY_BYTES = 4096;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function withDeviceCookie(res: NextResponse, deviceId: string): NextResponse {
  // NextResponse.cookies.set serialises SameSite as "lax". The cookie contract
  // is the explicit attribute string (HttpOnly; Secure; SameSite=Lax).
  res.headers.append(
    "set-cookie",
    `${DEVICE_COOKIE_NAME}=${deviceId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DEVICE_COOKIE_MAX_AGE_SECONDS}`,
  );
  return res;
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    if (!isFeedbackEnabled()) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "invalid_input" }, { status: 415 });
    }

    if (!sameOrigin(req)) {
      logFeedback({ event: "feedback_rejected", code: "bad_origin" });
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "invalid_input" }, { status: 413 });
    }

    const ip = clientIp(req);
    const now = Date.now();
    if (!checkFeedbackRateLimit(ip, now)) {
      logFeedback({ event: "feedback_rejected", code: "rate_limited" });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const cookieHeader = req.headers.get("cookie");
    if (
      !readDeviceIdFromCookieHeader(cookieHeader) &&
      !checkFeedbackRateLimit(`new:${ip}`, now, 3)
    ) {
      logFeedback({ event: "feedback_rejected", code: "rate_limited" });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    let raw: string;
    try {
      raw = await req.text();
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "invalid_input" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const parsed = feedbackBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    if (!checkFeedbackRateLimit(`ref:${ip}:${parsed.data.reportRef}`, now, 3)) {
      logFeedback({ event: "feedback_rejected", code: "rate_limited" });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    if (!quoteHashSecret()) {
      logFeedback({ event: "feedback_unavailable", code: "secret_missing" });
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    const result = await submitCompanyReportFeedback({
      ...parsed.data,
      cookieHeader,
    });

    const response =
      result.status === 204
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(
            {
              error: result.status === 404 ? "not_found" : "unavailable",
            },
            { status: result.status },
          );

    if (!result.deviceId) return response;
    return withDeviceCookie(response, result.deviceId);
  } catch {
    logFeedback({ event: "feedback_unavailable", code: "handler_error" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
