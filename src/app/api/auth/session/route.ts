import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";

export const instant = false;

export async function GET() {
  await connection();
  const user = await getAuthUser();
  return NextResponse.json({ signedIn: Boolean(user) });
}
