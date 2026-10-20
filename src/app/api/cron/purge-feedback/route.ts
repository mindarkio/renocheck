import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgeExpiredFeedback } from "@/lib/feedback/store";

function cronAuth(req: Request): "ok" | "missing" | "denied" {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return "missing";
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actual = Buffer.from(header);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return "denied";
  }
  return "ok";
}

export async function GET(req: Request) {
  const auth = cronAuth(req);
  if (auth === "missing") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (auth === "denied") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredFeedback();
    if (!result.ok) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json(
      { ok: true, deleted: result.deleted },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
