"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  buildSessionToken,
  clientIpFromForwarded,
  finishLoginAttempt,
  getAdminAuthConfig,
  reserveLoginAttempt,
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
  // Vercel overwrites x-forwarded-for with the real client IP, so the first hop is not client-controlled there.
  const ip = clientIpFromForwarded(h.get("x-forwarded-for"));
  // Reserve synchronously before checking the PIN, so concurrent requests can't all slip past the lock.
  const reserved = reserveLoginAttempt(ip);
  if (reserved.status === "locked") redirect("/admin/login?error=locked");

  const submitted = String(formData.get("pin") ?? "");
  const ok = verifyAdminPin(submitted, config);
  const attempt = await finishLoginAttempt(ip, ok);
  if (!ok) {
    if (attempt.status === "locked") redirect("/admin/login?error=locked");
    redirect("/admin/login?error=wrong");
  }

  const token = buildSessionToken(config, pin, Date.now());
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SEC));
  redirect("/admin");
}
