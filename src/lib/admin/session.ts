import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifySessionToken,
} from "@/lib/admin/auth";

export function adminEnvPin(): string | null {
  const pin = process.env.ADMIN_DASHBOARD_PIN?.trim();
  return pin && pin.length > 0 ? pin : null;
}

export async function isAdminSessionValid(nowMs = Date.now()): Promise<boolean> {
  const config = getAdminAuthConfig();
  const pin = adminEnvPin();
  if (!config || !pin) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token, config, pin, nowMs);
}
