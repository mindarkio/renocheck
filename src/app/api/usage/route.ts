import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { usageEventBodySchema } from "@/lib/usage-event";
import { recordUsageEvent } from "@/lib/usage-event-store";

export const maxDuration = 15;

const MAX_BODY_BYTES = 1024;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function requestHost(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const host = req.headers.get("host")?.trim();
  if (host) return host;
  try {
    return new URL(req.url).host;
  } catch {
    return "";
  }
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === requestHost(req);
  } catch {
    return false;
  }
}

/**
 * Same window as POST /api/search: 5 requests / 60s per IP, in memory only.
 * The key is separate so these lightweight posts do not use up the search budget.
 * IP is not written next to the anonymous id.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`usage:${ip}`)) {
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

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = usageEventBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await recordUsageEvent(null, {
    anonId: parsed.data.anonId,
    eventType: parsed.data.eventType,
    fingerprint: parsed.data.fingerprint ?? null,
  });

  return new NextResponse(null, { status: 204 });
}
