/** Normalize LRS / import defendant labels before MWC lookup. */

export function decodeHtmlEntities(label: string): string {
  return label
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export function stripDefendantPartySuffix(label: string): string {
  return label
    .replace(/\s+及另[一二三四五六七八九十\d]+人$/u, "")
    .replace(/\s+AND\s+ANOTHER(S)?$/iu, "")
    .replace(/及另一人$/u, "")
    .trim();
}

export function defendantLabelForMwcLookup(raw: string): string {
  return stripDefendantPartySuffix(decodeHtmlEntities(raw.trim()));
}
