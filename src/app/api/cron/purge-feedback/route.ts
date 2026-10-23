import { NextResponse } from "next/server";
import { cronAuth } from "@/lib/cron-auth";
import { purgeExpiredFeedback } from "@/lib/feedback/store";

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
