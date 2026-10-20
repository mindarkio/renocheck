import { NextResponse } from "next/server";
import {
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
} from "@/lib/device-id";
import { isFeedbackEnabled, quoteHashSecret } from "@/lib/feedback/config";
import { logFeedback } from "@/lib/feedback/log";
import { checkFeedbackRateLimit } from "@/lib/feedback/rate-limit";
import { feedbackBodySchema } from "@/lib/feedback/schema";
import { submitCompanyReportFeedback } from "@/lib/feedback/store";

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

export async function POST(req: Request) {
  try {
    if (!checkFeedbackRateLimit(clientIp(req))) {
      logFeedback({ event: "feedback_rejected", code: "rate_limited" });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const parsed = feedbackBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    if (!isFeedbackEnabled()) {
      logFeedback({ event: "feedback_unavailable", code: "disabled" });
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    if (!quoteHashSecret()) {
      logFeedback({ event: "feedback_unavailable", code: "secret_missing" });
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }

    const result = await submitCompanyReportFeedback({
      ...parsed.data,
      cookieHeader: req.headers.get("cookie"),
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
