/** Numeric tokens in summary must appear in source quote (dry-run QA). */

function normalizeDigits(s: string): string {
  return s.replace(/[,，]/g, "").replace(/\s+/g, "");
}

function extractNumericTokens(text: string): string[] {
  const tokens = new Set<string>();
  const re =
    /(?:HK\$|港幣|港币|\$)?\s*(\d{1,3}(?:[,，]\d{3})+|\d+)(?:\.\d+)?(?:\s*元)?/gi;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const digits = normalizeDigits(raw.replace(/[^\d.]/g, ""));
    if (digits.length >= 2) tokens.add(digits);
  }
  return [...tokens];
}

export function keyPointNumbersAppearInQuote(
  keyPointZh: string,
  sourceQuoteZh: string,
): boolean {
  const nums = extractNumericTokens(keyPointZh);
  if (nums.length === 0) return true;
  const quoteNorm = normalizeDigits(sourceQuoteZh);
  const quoteRaw = sourceQuoteZh;
  return nums.every((n) => {
    const bare = n.replace(/\.\d+$/, "");
    return (
      quoteNorm.includes(n) ||
      quoteNorm.includes(bare) ||
      quoteRaw.includes(n) ||
      quoteRaw.includes(bare)
    );
  });
}

export function sanitizeSummaryPoint(
  point: { keyPointZh: string; sourceQuoteZh: string },
): { keyPointZh: string; sourceQuoteZh: string } | null {
  if (!keyPointNumbersAppearInQuote(point.keyPointZh, point.sourceQuoteZh)) {
    return null;
  }
  return point;
}
