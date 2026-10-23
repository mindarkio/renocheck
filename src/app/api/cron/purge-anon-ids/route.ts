import { NextResponse } from "next/server";
import { purgeReturningUserAnonIds } from "@/lib/anon-id-retention-store";
import { cronAuth } from "@/lib/cron-auth";

/** Daily (vercel.json). Clears anonymous ids older than 90 days; rows stay. */
export async function GET(req: Request) {
  const auth = cronAuth(req);
  if (auth === "missing") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (auth === "denied") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeReturningUserAnonIds();
    if (!result.ok) {
      console.warn(JSON.stringify({ event: "anon_id_purge_failed", code: result.code }));
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    // Counts only. Never log an anonymous id.
    console.info(
      JSON.stringify({
        event: "anon_id_purge",
        searchCleared: result.searchCleared,
        usageCleared: result.usageCleared,
        pending: result.pending,
      }),
    );
    return NextResponse.json(
      {
        ok: true,
        searchCleared: result.searchCleared,
        usageCleared: result.usageCleared,
        pending: result.pending,
      },
      { status: 200 },
    );
  } catch {
    console.warn(JSON.stringify({ event: "anon_id_purge_failed", code: "threw" }));
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
