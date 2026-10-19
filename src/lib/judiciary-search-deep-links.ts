import { splitMixedLabelParts } from "./cr-register/prefix";
import { buildLrsPartiesSearchResultUrl } from "./lrs-search-url";
import {
  DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
} from "./report-trust-copy-zh";

export const JUDICIARY_DCL_SEARCH_ACTION =
  "https://e-services.judiciary.hk/dcl/search.jsp";

export function hktDateDdmmyyyy(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const year = parts.find((p) => p.type === "year")?.value ?? "2000";
  return `${day}${month}${year}`;
}

export function buildDailyCauseListPostFields(
  partyName: string,
  now: Date,
): { lang: "tc"; date: string; mode: "search"; parties: string } {
  return {
    lang: "tc",
    date: hktDateDdmmyyyy(now),
    mode: "search",
    parties: Array.from(partyName.trim()).slice(0, 200).join(""),
  };
}

/** DCL parties query: null for digit-only labels (phone / BR); one language only for bilingual labels. */
export function dailyCauseListPartyQuery(label: string): string | null {
  const t = label.trim();
  if (!/\p{L}/u.test(t)) return null;
  const { zh, en } = splitMixedLabelParts(t);
  if (zh && en) return cleanZhPartyPart(zh);
  // English only: use the normalised part (full-width ＡＢＣ → ABC).
  if (en) return en;
  // "ZZQ（合成有限公司）" / "ZZQ/合成有限公司": one glued Latin word, so the split sees Chinese only.
  if (zh && /^[A-Za-z]/.test(zh)) {
    const cleaned = cleanZhPartyPart(zh);
    if (cleaned !== zh) return cleaned;
  }
  return t;
}

const OPEN_BRACKETS = "(（「【[";
const CLOSE_BRACKETS = ")）」】]";

/**
 * "ZZQ LIMITED（合成有限公司）" / "ZZQ LIMITED/合成有限公司" make the zh part come back as
 * "LIMITED(合成有限公司)", "LIMITED/合成有限公司", "(合成有限公司)", "【合成有限公司】".
 * Drop a leading Latin word glued by a separator or bracket, then any unbalanced edge bracket.
 */
function cleanZhPartyPart(zh: string): string {
  let z = zh.replace(/^[A-Za-z0-9.&'\s-]*[/(（「【[]\s*/u, "");
  let opens = 0;
  let closes = 0;
  for (const c of z) {
    if (OPEN_BRACKETS.includes(c)) opens += 1;
    else if (CLOSE_BRACKETS.includes(c)) closes += 1;
  }
  let end = z.length;
  while (end > 0 && closes > opens) {
    const c = z[end - 1]!;
    if (c.trim() === "") end -= 1;
    else if (CLOSE_BRACKETS.includes(c)) {
      end -= 1;
      closes -= 1;
    } else break;
  }
  z = z.slice(0, end).trim();
  // A close bracket before any open bracket means the strip cut into the name ("3D(香港)…"): keep zh.
  if (/^[^(（「【[]*[)）」】\]]/u.test(z)) return zh;
  return /\p{Script=Han}/u.test(z) ? z : zh;
}

/** Prefilled external search links (一撲即查); user leaves site to verify. */
export function buildJudiciaryDeepLinks(searchLabel: string) {
  const q = searchLabel.trim();
  const encoded = encodeURIComponent(q);
  return {
    lrsPartiesSearch: buildLrsPartiesSearchResultUrl(q),
    hkliiSearch: `https://www.hklii.hk/search?q=${encoded}`,
    dailyCauseListSearch: JUDICIARY_DAILY_CAUSE_LIST_URL,
    dailyCauseListAction: JUDICIARY_DCL_SEARCH_ACTION,
    dailyCauseListNote: DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  };
}
