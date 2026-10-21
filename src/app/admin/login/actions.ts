"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  buildSessionToken,
  clientIpFromForwarded,
  getAdminAuthConfig,
  getLoginBlockStatus,
  recordLoginAttempt,
  SESSION_MAX_AGE_SEC,
  sessionCookieOptions,
  verifyAdminPin,
} from "@/lib/admin/auth";
import { adminEnvPin } from "@/lib/admin/session";

export async function submitAdminLogin(formData: FormData): Promise<void> {
  await connection();
  const config = getAdminAuthConfig();
  const pin = adminEnvPin();
  if (!config || !pin) notFound();

  const h = await headers();
  const ip = clientIpFromForwarded(h.get("x-forwarded-for"));
  const blocked = getLoginBlockStatus(ip);
  if (blocked) redirect("/admin/login?error=locked");

  const submitted = String(formData.get("pin") ?? "");

  if (!verifyAdminPin(submitted, config)) {
    const attempt = await recordLoginAttempt(ip, false);
    if (attempt.status === "locked") redirect("/admin/login?error=locked");
    redirect("/admin/login?error=wrong");
  }

  const attempt = await recordLoginAttempt(ip, true);
  if (attempt.status === "locked") redirect("/admin/login?error=locked");

  const token = buildSessionToken(config, pin, Date.now());
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SEC));
  redirect("/admin");
}
