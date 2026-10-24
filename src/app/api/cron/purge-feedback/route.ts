import { NextResponse } from "next/server";
import { cronAuth } from "@/lib/cron-auth";
import { purgeExpiredFeedback } from "@/lib/feedback/store";

/** Daily at 18:15 UTC (vercel.json). Counts only; never log a user id. */
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
      console.warn(
        JSON.stringify({ event: "feedback_purge_failed", code: result.code }),
      );
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    console.info(
      JSON.stringify({
        event: "feedback_purge",
        deleted: result.deleted,
      }),
    );
    return NextResponse.json(
      { ok: true, deleted: result.deleted },
      { status: 200 },
    );
  } catch {
    console.warn(JSON.stringify({ event: "feedback_purge_failed", code: "threw" }));
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
