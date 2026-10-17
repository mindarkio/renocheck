/** Simplified → Traditional (HK subset + common company-name chars). */
const S2HK_MAP: Record<string, string> = {
  乐: "樂",
  叶: "葉",
  发: "發",
  装: "裝",
  饰: "飾",
  维: "維",
  护: "護",
  门: "門",
  东: "東",
  国: "國",
  华: "華",
  万: "萬",
  汇: "匯",
  丰: "豐",
  龙: "龍",
  隆: "隆",
};

export function toTraditionalHongKong(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFKC")) {
    out += S2HK_MAP[ch] ?? ch;
  }
  return out;
}

const EN_SUFFIX_RE =
  /\b(COMPANY LIMITED|CO\.?\s*LIMITED|COMPANY LTD|CO\.?\s*LTD|LIMITED|LTD\.?|INCORPORATED|INC\.?|CORPORATION|CORP\.?)\b/gi;

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
  const normCore = normStrict.replace(/\s+LTD\s*$/i, "").replace(/\s+\(HK\)\s*$/i, "").trim();
  return { normStrict, normCore };
}

export function normalizeChineseCompanyName(input: string): {
  normStrict: string;
  normCore: string;
} {
  let s = toTraditionalHongKong(input);
  s = s.replace(/[（）()・．.，,、\s]/g, "");
  s = s.replace(/有限公司$/u, "有限公司");
  const normStrict = s;
  const normCore = normStrict.replace(/有限公司$/u, "");
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

/** Levenshtein distance for CJK fuzzy (level C). */
export function cjkEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
