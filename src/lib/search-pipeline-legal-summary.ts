import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";

const PREFIX = LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX;
/** = riskReportSchema summaryZh .max, counted in UTF-16 units (String.length) */
const MAX = 120;
const PHRASE = "未見負面摘要";
const KEEP = "建議自行核實";

/** Sentences incl. trailing delimiter. Enders: 。！？；!?; and "." followed by space/end. */
export function splitSentences(text: string): string[] {
  return (
    text.match(
      /[^。！？；!?;.]*(?:\.(?!\s|$)[^。！？；!?;.]*)*(?:[。！？；!?;]+|\.(?=\s|$))?/g,
    ) ?? []
  )
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^[。！？；!?;.，,、\s]+$/.test(s));
}

/** Drop only the clause(s) containing PHRASE; strip a dangling 但/但是/不過/然而 that follows. */
function stripPhraseClauses(sentence: string): string {
  if (!sentence.includes(PHRASE)) return sentence;
  const end = sentence.match(/[。！？；!?;.]+$/)?.[0] ?? "";
  const core = sentence.slice(0, sentence.length - end.length);
  const clauses = core.split(/[，,]\s*/);
  const kept = clauses
    .filter((c) => !c.includes(PHRASE))
    .map((c, i) => (i === 0 ? c.replace(/^(但是|但|不過|然而)\s*/, "") : c))
    .filter((c) => c.trim().length > 0);
  if (kept.length === 0) return "";
  const sep =
    /[A-Za-z]/.test(core) && !/[\u4e00-\u9fff]/.test(kept.join(""))
      ? ", "
      : "，";
  return kept.join(sep) + (end || "。");
}

function cutUtf16(text: string, maxUnits: number): string {
  let out = "";
  for (const ch of Array.from(text)) {
    if (out.length + ch.length > maxUnits) break;
    out += ch;
  }
  return out;
}

/** Fit into maxUnits UTF-16 units; whole sentences first; KEEP sentence always kept if present. */
export function truncateSummaryZh(text: string, maxUnits: number): string {
  if (text.length <= maxUnits) return text;
  const sentences = splitSentences(text);
  const keepIdx = sentences.findIndex((s) => s.includes(KEEP));
  const keep = keepIdx >= 0 ? sentences[keepIdx] : "";
  let budget = maxUnits - keep.length;
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    if (i === keepIdx) continue;
    const s = sentences[i];
    if (s.length <= budget) {
      out.push(s);
      budget -= s.length;
    } else {
      if (out.length === 0 && budget > 1) out.push(cutUtf16(s, budget - 1) + "…");
      break;
    }
  }
  const joined =
    out.join(/[A-Za-z]$/.test(out.at(-1) ?? "") ? " " : "") + keep;
  return joined.length <= maxUnits
    ? joined
    : cutUtf16(joined, maxUnits - 1) + "…";
}

/** Prepend degraded hint and strip misleading「未見負面摘要」from summary text. */
export function summaryZhForLegalLookupDegraded(summaryZh: string): string {
  let body = summaryZh.trim();
  while (body.startsWith(PREFIX)) body = body.slice(PREFIX.length).trim();
  const sentences = splitSentences(body).map(stripPhraseClauses).filter(Boolean);
  body = sentences.reduce(
    (acc, s) =>
      acc && /[.!?;]$/.test(acc) ? `${acc} ${s}` : acc + s,
    "",
  );
  return PREFIX + truncateSummaryZh(body, MAX - PREFIX.length);
}
