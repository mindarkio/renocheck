import { redactFeedbackComment } from "@/lib/feedback/redact";
import type {
  ActionableClause,
  DiscussionHighlight,
  RetrievalEvidenceItem,
  RiskReport,
} from "@/lib/report-schema";

/**
 * Length caps match `report-schema.ts`. The shared redactor also stops at 500
 * characters; these clamps keep a name-dense field inside the schema max.
 */
const SUMMARY_MAX = 120;
const HIGHLIGHT_SUMMARY_MAX = 160;
const FACT_SUMMARY_MAX = 160;
const SOURCE_NAME_MAX = 60;
const DATE_HINT_MAX = 40;
const EVIDENCE_TITLE_MAX = 200;
const EVIDENCE_SNIPPET_MAX = 280;
const MATCHED_TOKEN_MAX = 80;
/** `redactFeedbackComment` already stops at 500. Themes and deprecated snippets have no tighter schema max. */
const REDACTOR_MAX = 500;
const CLAUSE_CATEGORY_MAX = 40;
const CLAUSE_TEXT_MAX = 200;
const CLAUSE_REASON_MAX = 120;

/**
 * Report prose is longer and more formal than feedback comments, so a few
 * feedback heuristics misfire on it. Spans matched here are held out of the
 * shared redactor and put back unchanged afterwards. Feedback is not affected.
 */
const SURNAME_CHARS =
  "陳李張黃何林梁吳劉王鄭楊謝郭蔡曾鄧許馮朱蘇葉羅周盧潘余麥彭胡譚馬鍾袁莫江杜歐姚方鄒廖戴文鄺崔范程施霍冼甘關邱孔古石韋雷傅丁薛嚴洪簡湯翁符龐區岑卓唐姜尹萬高孫徐凌錢柯蕭樊侯賴呂金游熊史顏溫黎倪聶魏夏植招容伍利屈祁邵董任葛衛衞花白單田康蔣沈邢連魯陈张黄刘郑杨谢邓许冯苏叶罗卢钟谭马邹欧邝关韦汤庞区万孙萧赖吕颜温聂卫单蒋连鲁严钱";
/** Nouns that end in a surname character and are often followed by adverb 太 (工程太慢). */
const NOUN_BEFORE_TAI = new Set([
  "工程", "價錢", "工錢", "訂金", "按金", "對方", "地方", "雙方", "一方", "溫度", "用料", "價格", "收費",
]);
const ADVERB_TAI_NEXT = "長短貴差耐慢快多少高低大細遲早好壞過熱凍舊離急窄闊重輕難誇夠忙亂嘈吵濕乾薄厚粗";
const ROLE_PREFIX_SIFU = /(?:該名|多名|涉事|負責|有關|相關|其他|個別|部分|工人|另一名|一名|兩名|該|此|其|眾)(?:師傅|師父|师傅|师父)/g;
const STREET_TOKEN = /(?:街|道|路|里|徑|村|邨|苑|大廈|中心|廣場|花園|閣|商場|大樓|屋)/;
const REPORT_FP_RULES: RegExp[] = [
  // Dates and court case numbers look like 8-digit phones.
  /(?<!\d)(?:19|20)\d{2}\s?[-/.]\s?\d{1,2}\s?[-/.]\s?\d{1,2}(?!\d)/g,
  /(?<!\d)\d{1,2}\s?[-/.]\s?\d{1,2}\s?[-/.]\s?(?:19|20)\d{2}(?!\d)/g,
  /\b[A-Z]{2,6}\s?\d{1,5}\s?\/\s?(?:19|20)\d{2}\b/g,
  // The searched business's own BR number, and money amounts.
  /(?:商業登記(?:號碼|證)?|商登|BR(?:\s?No\.?)?)\s*[:：]?\s*\d{8}/gi,
  /(?:HK\$|\$|港幣|港元)\s?\d[\d,]*/gi,
  ROLE_PREFIX_SIFU,
];

/** Private-use chars: never matched by the shared redactor's patterns. */
const SENTINEL_BASE = 0xe000;
const SENTINEL_MAX = 0x1000;
const SENTINEL_RE = /[\uE000-\uEFFF]/g;

type Protected = { text: string; spans: string[] };

function hold(state: Protected, re: RegExp, keep?: (m: string, at: number, s: string) => boolean) {
  state.text = state.text.replace(re, (m: string, ...rest: unknown[]) => {
    const at = rest.find((x) => typeof x === "number") as number;
    if (keep && !keep(m, at, state.text)) return m;
    if (state.spans.length >= SENTINEL_MAX) return m;
    state.spans.push(m);
    return String.fromCharCode(SENTINEL_BASE + state.spans.length - 1);
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectReportProse(raw: string, exemptNames: readonly string[]): Protected {
  const state: Protected = { text: raw.replace(SENTINEL_RE, ""), spans: [] };
  for (const name of exemptNames) hold(state, new RegExp(escapeRe(name), "g"));
  for (const re of REPORT_FP_RULES) hold(state, re);
  // Adverb 太 (工期太長): held unless it follows a lone surname (陳太好嬲).
  hold(state, new RegExp(`太(?=[${ADVERB_TAI_NEXT}])`, "g"), (_m, at, s) => {
    const prev = s[at - 1] ?? "";
    if (!SURNAME_CHARS.includes(prev)) return true;
    return NOUN_BEFORE_TAI.has(s.slice(at - 2, at));
  });
  // Role words (項目經理, 公司老闆, 業主太太): held unless a surname comes right before.
  hold(state, /(?:經理|老闆|太太)/g, (_m, at, s) => !SURNAME_CHARS.includes(s[at - 1] ?? ""));
  // Floor / block / clause numbers without a street or estate word nearby are not an address.
  hold(state, /\d{1,6}\s?[樓座室號]/g, (_m, at, s) => !STREET_TOKEN.test(s.slice(Math.max(0, at - 12), at)));
  return state;
}

function restore(text: string, spans: readonly string[]): string {
  return text.replace(SENTINEL_RE, (c) => spans[c.charCodeAt(0) - SENTINEL_BASE] ?? "");
}

/** Do not leave half a placeholder (「[姓」) or half a surrogate pair at the cut. */
function clamp(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength);
  cut = cut.replace(/\[[^\]]{0,3}$/, "").replace(/[\uD800-\uDBFF]$/, "");
  return cut;
}

function redactFreeText(value: string, maxLength: number, exemptNames: readonly string[]): string {
  const held = protectReportProse(value, exemptNames);
  const redacted = restore(redactFeedbackComment(held.text), held.spans);
  return clamp(redacted, maxLength);
}

/** Names already shown in clear in the same response (DEC-0011); masking them in prose only breaks the report. */
function exemptNamesFor(report: RiskReport): string[] {
  const cr = report.official?.companiesRegistry;
  const names = [
    report.entity?.displayName,
    report.entity?.searchLabelUsed,
    ...(report.entity?.queryEcho ?? "").split(" · "),
    report.official?.details?.companyName,
    cr?.nameZh,
    cr?.nameEn,
    ...(cr?.candidateNames ?? []).flatMap((c) => [c.nameZh, c.nameEn]),
  ];
  const out = new Set<string>();
  for (const n of names) {
    const t = n?.trim();
    // Skip digits-only parts (the searched phone / BR) and single characters.
    if (t && t.length >= 2 && /\D/.test(t)) out.add(t);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function redactHighlight(item: DiscussionHighlight, ex: readonly string[]): DiscussionHighlight {
  return {
    ...item,
    summaryZh: redactFreeText(item.summaryZh, HIGHLIGHT_SUMMARY_MAX, ex),
    ...(item.factSummary !== undefined
      ? { factSummary: redactFreeText(item.factSummary, FACT_SUMMARY_MAX, ex) }
      : {}),
    ...(item.sourceName !== undefined
      ? { sourceName: redactFreeText(item.sourceName, SOURCE_NAME_MAX, ex) }
      : {}),
    ...(item.dateHint !== undefined
      ? { dateHint: redactFreeText(item.dateHint, DATE_HINT_MAX, ex) }
      : {}),
  };
}

function redactEvidence(item: RetrievalEvidenceItem, ex: readonly string[]): RetrievalEvidenceItem {
  return {
    ...item,
    title: redactFreeText(item.title, EVIDENCE_TITLE_MAX, ex),
    snippetExcerpt: redactFreeText(item.snippetExcerpt, EVIDENCE_SNIPPET_MAX, ex),
    matchedToken: redactFreeText(item.matchedToken, MATCHED_TOKEN_MAX, ex),
  };
}

function redactClause(item: ActionableClause, ex: readonly string[]): ActionableClause {
  return {
    category: redactFreeText(item.category, CLAUSE_CATEGORY_MAX, ex),
    clauseText: redactFreeText(item.clauseText, CLAUSE_TEXT_MAX, ex),
    reason: redactFreeText(item.reason, CLAUSE_REASON_MAX, ex),
  };
}

/**
 * Public body of `POST /api/search` and `GET /api/report/[fingerprint]`.
 *
 * Runs at serialization. `search_cache.report` stays as stored so admin
 * company-name reads stay unchanged, and an existing row is redacted when
 * it is served. Registry identity fields stay as stored (DEC-0011), and the
 * same names are not masked where they appear in prose.
 */
export function redactReportForPublicResponse(report: RiskReport): RiskReport {
  const ex = exemptNamesFor(report);
  const premium = report.premium;
  return {
    ...report,
    summaryZh: redactFreeText(report.summaryZh, SUMMARY_MAX, ex),
    signals: {
      ...report.signals,
      themes: report.signals.themes.map((theme) => redactFreeText(theme, REDACTOR_MAX, ex)),
      highlights: report.signals.highlights?.map((h) => redactHighlight(h, ex)),
      retrievalEvidence: report.signals.retrievalEvidence.map((e) => redactEvidence(e, ex)),
      actionableClauses: report.signals.actionableClauses.map((c) => redactClause(c, ex)),
    },
    ...(premium
      ? {
          premium: {
            ...premium,
            discussionSnippets: premium.discussionSnippets.map((item) => ({
              ...item,
              title: redactFreeText(item.title, REDACTOR_MAX, ex),
              excerpt: redactFreeText(item.excerpt, REDACTOR_MAX, ex),
            })),
          },
        }
      : {}),
  };
}
