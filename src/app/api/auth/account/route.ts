import { NextResponse } from "next/server";
import { deleteAccountAndAnalyses } from "@/lib/auth/delete-account";
import { sameOrigin } from "@/lib/request-guards";
import {
  ACCOUNT_DELETE_ACK_ZH,
  ACCOUNT_DELETE_ERROR_ZH,
  QUOTE_AUTH_REQUIRED_ZH,
} from "@/lib/quote-analysis/copy";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  getAuthUser,
} from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const confirm =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).confirm
      : null;
  if (confirm !== "delete") {
    return NextResponse.json(
      { error: "acknowledgement_required", message: ACCOUNT_DELETE_ACK_ZH },
      { status: 400 },
    );
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: QUOTE_AUTH_REQUIRED_ZH },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "unavailable", message: ACCOUNT_DELETE_ERROR_ZH },
      { status: 503 },
    );
  }

  const removed = await deleteAccountAndAnalyses(admin, user.id);
  if (!removed) {
    return NextResponse.json(
      { error: "unavailable", message: ACCOUNT_DELETE_ERROR_ZH },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
