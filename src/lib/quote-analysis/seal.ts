import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { StoredQuoteItem } from "@/lib/quote-analysis/schema";

export const QUOTE_SEAL_TTL_MS = 30 * 60 * 1000;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type SealedQuotePayload = {
  v: 1;
  exp: number;
  nonce: string;
  items: StoredQuoteItem[];
  companyName: string | null;
  pageCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  actualMicroUsd: number | null;
};

/** SHA-256 of a server-only secret that is at least 32 bytes. */
export function quoteSealKey(
  env: Record<string, string | undefined> = process.env,
): Buffer | null {
  const raw = env.QUOTE_RESULT_SEAL_SECRET ?? "";
  if (Buffer.byteLength(raw) < 32) return null;
  return createHash("sha256").update(raw, "utf8").digest();
}

export function sealQuoteResult(
  input: Omit<SealedQuotePayload, "v" | "exp" | "nonce">,
  env: Record<string, string | undefined>,
  now = Date.now(),
): { sealed: string; nonce: string; exp: number } {
  const key = quoteSealKey(env);
  if (!key) throw new Error("seal_unavailable");
  const nonce = randomBytes(16).toString("hex");
  const exp = now + QUOTE_SEAL_TTL_MS;
  const payload: SealedQuotePayload = { v: 1, exp, nonce, ...input };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    sealed: Buffer.concat([iv, tag, encrypted]).toString("base64url"),
    nonce,
    exp,
  };
}

export function openQuoteResult(
  sealed: string,
  env: Record<string, string | undefined>,
  now = Date.now(),
): SealedQuotePayload {
  const key = quoteSealKey(env);
  if (!key) throw new Error("seal_unavailable");
  let buf: Buffer;
  try {
    buf = Buffer.from(sealed, "base64url");
  } catch {
    throw new Error("seal_invalid");
  }
  if (buf.length < IV_BYTES + TAG_BYTES + 2) throw new Error("seal_invalid");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let plain: string;
  try {
    plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("seal_invalid");
  }
  let parsed: SealedQuotePayload;
  try {
    parsed = JSON.parse(plain) as SealedQuotePayload;
  } catch {
    throw new Error("seal_invalid");
  }
  if (
    parsed.v !== 1 ||
    typeof parsed.nonce !== "string" ||
    !/^[0-9a-f]{32}$/.test(parsed.nonce) ||
    typeof parsed.exp !== "number"
  ) {
    throw new Error("seal_invalid");
  }
  if (!Array.isArray(parsed.items)) throw new Error("seal_invalid");
  if (parsed.exp <= now) throw new Error("seal_expired");
  return parsed;
}
