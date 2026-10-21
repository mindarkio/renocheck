import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  getAdminEnvPin,
  verifySessionToken,
} from "@/lib/admin/auth";

export function adminEnvPin(): string | null {
  return getAdminEnvPin();
}

export async function isAdminSessionValid(nowMs = Date.now()): Promise<boolean> {
  const config = getAdminAuthConfig();
  const pin = adminEnvPin();
  if (!config || !pin) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token, config, pin, nowMs);
}
