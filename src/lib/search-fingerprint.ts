import { createHash } from "node:crypto";
import type { NormalizedSearchInput } from "./normalize-search-input";

export function buildSearchFingerprint(input: NormalizedSearchInput): string {
  const parts: string[] = [];
  if (input.phone) parts.push(`p:${input.phone}`);
  if (input.br) parts.push(`b:${input.br.toLowerCase()}`);
  if (input.companyName) parts.push(`c:${input.companyName.toLowerCase()}`);
  if (input.mwcRegistrationNo) parts.push(`r:${input.mwcRegistrationNo.toLowerCase()}`);

  const canonical = parts.join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}
