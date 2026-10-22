import "server-only";

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

/**
 * Logout only clears this browser's cookie. To invalidate every active session at once,
 * rotate `ADMIN_SESSION_SECRET` (or change `ADMIN_DASHBOARD_PIN`) in Vercel and redeploy.
 * Phase 0 has no server-side session store.
 */
export async function isAdminSessionValid(nowMs = Date.now()): Promise<boolean> {
  const config = getAdminAuthConfig();
  const pin = adminEnvPin();
  if (!config || !pin) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token, config, pin, nowMs);
}
