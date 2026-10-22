"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ADMIN_SESSION_COOKIE, sessionCookieOptions } from "@/lib/admin/auth";

export async function submitAdminLogout(): Promise<void> {
  await connection();
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, "", sessionCookieOptions(0));
  redirect("/admin/login");
}
