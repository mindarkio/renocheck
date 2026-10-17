import { Converter } from "opencc-js";

const cnToHk = Converter({ from: "cn", to: "hk" });

export function toTraditionalHongKong(text: string): string {
  return cnToHk(text.normalize("NFKC"));
}

const EN_SUFFIX_RE =
  /\b(COMPANY LIMITED|CO\.?\s*LIMITED|COMPANY LTD|CO\.?\s*LTD|LIMITED|LTD\.?|INCORPORATED|INC\.?|CORPORATION|CORP\.?)\b/gi;

const REGIONAL_ZH_RE = /（香港）|\(香港\)/gu;
const REGIONAL_EN_RE = /\b(HONG KONG|\(HK\)|\bHK\b)\b/gi;

export function normalizeEnglishCompanyName(input: string): {
  normStrict: string;
  normCore: string;
} {
  let s = input.normalize("NFKC").toUpperCase();
  s = s.replace(/\s*&\s*/g, " AND ");
  s = s.replace(/[.,'"\-]/g, " ");
  s = s.replace(/\((HONG KONG|HK|ASIA)\)/gi, (_, r: string) => {
    const token = r.toUpperCase().includes("HONG") ? "(HK)" : `(${r.toUpperCase()})`;
    return ` ${token} `;
  });
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(EN_SUFFIX_RE, " LTD ");
  s = s.replace(/\bCOMPANY\b/g, " CO ");
  s = s.replace(/\bCO\b/g, " CO ");
  s = s.replace(/\s+/g, " ").trim();
  const normStrict = s;
  let normCore = normStrict.replace(/\s+LTD\s*$/i, "").trim();
  normCore = normCore.replace(/\s+\(HK\)\s*$/i, "").trim();
  normCore = normCore.replace(REGIONAL_EN_RE, " ").replace(/\s+/g, " ").trim();
  return { normStrict, normCore };
}

export function normalizeChineseCompanyName(input: string): {
  normStrict: string;
  normCore: string;
} {
  const s = toTraditionalHongKong(input);
  const clean = (x: string) => x.replace(/[（）()・．.，,、\s]/g, "");
  const normStrict = clean(s);
  const normCore = clean(s.replace(REGIONAL_ZH_RE, "")).replace(/有限公司$/u, "");
  return { normStrict, normCore };
}

export function normalizeCompanyName(input: string): {
  normStrict: string;
  normCore: string;
  script: "en" | "zh" | "mixed";
} {
  const hasCjk = /[\u4e00-\u9fff]/u.test(input);
  const hasLatin = /[A-Za-z]/.test(input);
  if (hasCjk && !hasLatin) {
    const zh = normalizeChineseCompanyName(input);
    return { ...zh, script: "zh" };
  }
  if (hasLatin && !hasCjk) {
    const en = normalizeEnglishCompanyName(input);
    return { ...en, script: "en" };
  }
  const en = normalizeEnglishCompanyName(input.replace(/[\u4e00-\u9fff]+/gu, ""));
  const zh = normalizeChineseCompanyName(input.replace(/[A-Za-z]+/g, ""));
  return {
    normStrict: `${en.normStrict}|${zh.normStrict}`,
    normCore: `${en.normCore}|${zh.normCore}`,
    script: "mixed",
  };
}

/** Levenshtein distance for CJK fuzzy (level C); code-point aware (L6). */
export function cjkEditDistance(a: string, b: string): number {
  const ca = [...a];
  const cb = [...b];
  if (ca.join("") === cb.join("")) return 0;
  const m = ca.length;
  const n = cb.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = ca[i - 1] === cb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Split bilingual cause-list name without brackets (M6). */
export function splitBilingualCompanyRaw(raw: string): { en?: string; zh?: string } {
  const idx = raw.search(/[\u4e00-\u9fff]/u);
  if (idx <= 0) return {};
  const en = raw.slice(0, idx).replace(/[.,\s]+$/u, "").trim();
  const zh = raw.slice(idx).trim();
  if (!en || !zh) return {};
  return { en, zh };
}
