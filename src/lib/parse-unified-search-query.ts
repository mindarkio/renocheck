import { normalizeHongKongPhone } from "./normalize-phone";

export type ParsedUnifiedSearchQuery =
  | { kind: "empty" }
  | { kind: "phone"; phone: string }
  | { kind: "br"; br: string }
  | { kind: "company_name"; companyName: string };

const BR_CERT_PATTERN =
  /^\d{8}(-\d{3})?(-\d{2})?(-\d{2})?(-\d{1})?$/;

/** Map one search box string to API search fields (landing / Google-style). */
export function parseUnifiedSearchQuery(raw: string): ParsedUnifiedSearchQuery {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };

  const brPrefix = /^br\s*[-#:]*\s*([\d\s-]+)$/i.exec(trimmed);
  if (brPrefix) {
    const br = brPrefix[1].replace(/\s/g, "");
    if (br.length >= 7) return { kind: "br", br };
  }

  const compact = trimmed.replace(/\s/g, "");
  if (/-\d/.test(compact) && BR_CERT_PATTERN.test(compact)) {
    return { kind: "br", br: compact };
  }

  const hasLetters = /[a-zA-Z\u4e00-\u9fff]/.test(trimmed);
  const digits = trimmed.replace(/\D/g, "");

  if (!hasLetters && digits.length > 0) {
    const phoneNorm = normalizeHongKongPhone(trimmed);
    if (phoneNorm && digits.length >= 8) {
      if (digits.length === 8 && !looksLikeHongKongPhone(phoneNorm)) {
        return { kind: "br", br: phoneNorm };
      }
      return { kind: "phone", phone: trimmed };
    }
    if (digits.length >= 7 && digits.length <= 12) {
      return { kind: "br", br: digits };
    }
  }

  return { kind: "company_name", companyName: trimmed };
}

/** Mobile / landline heuristics — 8-digit BR shares length with HK numbers. */
function looksLikeHongKongPhone(eightDigits: string): boolean {
  return /^[235689]/.test(eightDigits);
}

export function parsedSearchQueryLabel(
  parsed: ParsedUnifiedSearchQuery,
): string | null {
  switch (parsed.kind) {
    case "phone":
      return "香港電話";
    case "br":
      return "商業登記號碼";
    case "company_name":
      return "公司名稱";
    default:
      return null;
  }
}

export function toSearchInputBody(
  parsed: ParsedUnifiedSearchQuery,
): { companyName?: string; phone?: string; br?: string } | null {
  switch (parsed.kind) {
    case "phone":
      return { phone: parsed.phone };
    case "br":
      return { br: parsed.br };
    case "company_name":
      return { companyName: parsed.companyName };
    default:
      return null;
  }
}
