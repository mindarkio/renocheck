import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/request-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
