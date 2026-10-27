import { createHash } from "node:crypto";
import type { NormalizedSearchInput } from "./normalize-search-input";

export function buildSearchFingerprint(input: NormalizedSearchInput): string {
  if (input.mwcRegistrationNo) {
    // JSON keeps field edges, so a typed "x|r:y" cannot equal the pick (x, y).
    // Starts with "[" and so never equals a legacy "p:/b:/c:" string.
    const canonical = JSON.stringify([
      "pick-v2",
      input.phone ?? null,
      input.br?.toLowerCase() ?? null,
      input.companyName?.toLowerCase() ?? null,
      input.mwcRegistrationNo.toLowerCase(),
    ]);
    return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  }

  const parts: string[] = [];
  if (input.phone) parts.push(`p:${input.phone}`);
  if (input.br) parts.push(`b:${input.br.toLowerCase()}`);
  if (input.companyName) parts.push(`c:${input.companyName.toLowerCase()}`);

  const canonical = parts.join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}
