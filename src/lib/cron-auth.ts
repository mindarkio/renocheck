import { timingSafeEqual } from "node:crypto";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function cronAuth(req: Request): "ok" | "missing" | "denied" {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return "missing";
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actual = Buffer.from(header);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    return "denied";
  }
  return "ok";
}
