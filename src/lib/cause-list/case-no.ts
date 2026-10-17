/** Case number token in DCL HTML (space optional: `LDBM51/2023`). */
export const CASE_NO_CAPTURE_RE =
  /\b(SCTC|DC[A-Z]{2}|HCA|HC[A-Z]{2,4}|CA[A-Z]{2}|LD[A-Z]{2})\s*(\d{1,6})\/(\d{4})\b/gi;

const LEGACY_CASE_RE = /\bSCTC\s*0*(\d{1,6})\/(\d{2})\b/i;

export function formatCaseNo(prefix: string, num: string, year: string): string {
  return `${prefix.toUpperCase()} ${num}/${year}`;
}

export function extractCaseNosFromText(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(CASE_NO_CAPTURE_RE.source, CASE_NO_CAPTURE_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(formatCaseNo(m[1], m[2], m[3]));
  }
  return out;
}

export function extractCasePrefix(caseNo: string): string {
  const m = caseNo.trim().match(/^([A-Z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

export function detectLegacyCaseFormat(html: string): boolean {
  return LEGACY_CASE_RE.test(html);
}

/** Count case-number tokens in raw HTML (smoke / verify). */
export function countRawCaseNosInHtml(html: string): number {
  const re = new RegExp(CASE_NO_CAPTURE_RE.source, CASE_NO_CAPTURE_RE.flags);
  let n = 0;
  while (re.exec(html) !== null) n += 1;
  return n;
}
