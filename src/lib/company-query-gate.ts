import { collapseSpacesBetweenCjk } from "./mwc-company-search-terms";
import { isPersonalSurname } from "./personal-name-surnames";
import { hasSearchTradeMarker, isGenericSearchAlias } from "./search-entity-labels";

/**
 * Company-name gate before any register lookup (DEC-0015).
 * Phones and BR numbers never enter this module — the search form only calls
 * it after the box has been read as a company name.
 */

/** English markers must stand alone: "Smart/Advance" is not "t/a". */
const TRADING_AS_EN_RE = /(?:^|[\s,(（])(?:trading\s+as|t\s*\/\s*a\.?)(?=[\s,:：)）]|$)/i;
const TRADING_AS_ZH = "經營";

const ENGLISH_TITLES = new Set(["mr", "mrs", "ms", "miss"]);

/**
 * Single characters used in trading names (李錦記、大昌行). They are not added
 * to the generic-alias list: that list also blocks a whole name made only of
 * trade words, and 行 appears inside ordinary company names.
 */
const TRADE_NAME_CHARS = ["記", "行", "號"] as const;

function hasTradeNameChar(text: string): boolean {
  return TRADE_NAME_CHARS.some((char) => text.includes(char));
}

/** Exactly three Han and a trading-name character: search it as a company. */
function isThreeHanTradeName(text: string): boolean {
  return /^\p{Script=Han}{3}$/u.test(text) && hasTradeNameChar(text);
}

/** Whole strings that end in 生/太 but are words, not 「X生」/「X太」. */
const NOT_A_PERSONAL_TITLE = new Set([
  "花生",
  "衛生",
  "衞生",
  "卫生",
  "招生",
  "學生",
  "学生",
  "醫生",
  "医生",
  "一生",
  "人生",
  "先生",
  "太太",
  "小姐",
  "師傅",
  "师傅",
]);

export type CompanyQueryGate =
  | { kind: "empty" }
  | { kind: "short"; input: string }
  | { kind: "personal"; input: string; allowCompanyOverride: boolean }
  | { kind: "search"; input: string };

export function normalizeCompanyQuery(raw: string): string {
  return collapseSpacesBetweenCjk(raw.normalize("NFKC").replace(/\u3000/g, " "))
    .replace(/[ \t]+/g, " ")
    .trim();
}

function hasDigit(value: string): boolean {
  return /\d/u.test(value.normalize("NFKC"));
}

/** 1–3 Han plus 生、太、先生、小姐、太太 or 師傅, and nothing else. */
export function isChineseTitledPersonalName(raw: string): boolean {
  const text = normalizeCompanyQuery(raw);
  if (!text || NOT_A_PERSONAL_TITLE.has(text)) return false;
  return /^(\p{Script=Han}{1,3})(先生|小姐|太太|師傅|师傅|生|太)$/u.test(text);
}

/** Exactly 3 Han and no trade word. Two Han stay on the short-name prompt. */
export function isBareThreeHanPersonalName(raw: string): boolean {
  const text = normalizeCompanyQuery(raw);
  if (!/^\p{Script=Han}{3}$/u.test(text)) return false;
  return !hasSearchTradeMarker(text) && !hasDigit(text);
}

/**
 * English, any mix of capitals: 2 or 3 words, letters only (apostrophes and
 * hyphens allowed), and a listed surname or a title (Mr, Mrs, Ms, Miss).
 * One English word does not match.
 */
export function isEnglishPersonalName(raw: string): boolean {
  const text = normalizeCompanyQuery(raw);
  if (!text || hasDigit(text) || hasSearchTradeMarker(text)) return false;
  const parts = text.split(" ");
  if (parts.length < 2 || parts.length > 3) return false;
  const words: string[] = [];
  for (const part of parts) {
    const word = part.replace(/^\.+|\.+$/g, "");
    if (!/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/u.test(word)) return false;
    words.push(word.toLowerCase().replace(/’/g, "'"));
  }
  return words.some((word) => ENGLISH_TITLES.has(word) || isPersonalSurname(word));
}

export function isPersonalName(raw: string): boolean {
  const text = normalizeCompanyQuery(raw);
  if (!text || hasDigit(text) || hasSearchTradeMarker(text) || hasTradeNameChar(text)) {
    return false;
  }
  if (isChineseTitledPersonalName(text)) return true;
  if (isEnglishPersonalName(text)) return true;
  return isBareThreeHanPersonalName(text);
}

/**
 * Search the trading name after 經營 / trading as / t/a.
 * An empty remainder must not fall back to the owner's name.
 */
export function tradingNameFromCompanyQuery(raw: string): {
  query: string;
  ownerOnly: boolean;
} {
  const text = normalizeCompanyQuery(raw);
  let rest: string | null = null;
  const en = TRADING_AS_EN_RE.exec(text);
  if (en) {
    rest = text.slice(en.index + en[0].length).trim();
  } else {
    // 經營 is also an ordinary word in register names (物業經營管理有限公司).
    // Split only when what comes before it is empty or reads as a person.
    const at = text.indexOf(TRADING_AS_ZH);
    if (at >= 0) {
      const owner = text.slice(0, at).trim();
      if (!owner || isPersonalName(owner)) {
        rest = text.slice(at + TRADING_AS_ZH.length).trim();
      }
    }
  }
  if (rest == null) return { query: text, ownerOnly: false };
  if (!rest) return { query: text, ownerOnly: true };
  return { query: rest, ownerOnly: false };
}

export function classifyCompanyNameQuery(raw: string): CompanyQueryGate {
  const typed = normalizeCompanyQuery(raw);
  if (!typed) return { kind: "empty" };

  const trading = tradingNameFromCompanyQuery(typed);
  if (trading.ownerOnly) return { kind: "short", input: typed };

  const input = trading.query;
  if (isPersonalName(input)) {
    return { kind: "personal", input, allowCompanyOverride: true };
  }
  if (isThreeHanTradeName(input)) return { kind: "search", input };
  if (isGenericSearchAlias(input)) return { kind: "short", input };
  return { kind: "search", input };
}
