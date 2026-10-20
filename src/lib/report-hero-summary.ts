import { legalEventAffectsHeroDisputeWarning } from "./legal-event-calibration";
import type { RiskReport } from "./report-schema";

const HERO_SUMMARY_MAX = 160;

function trimHeroSummary(text: string): string {
  return text.length <= HERO_SUMMARY_MAX ? text : `${text.slice(0, HERO_SUMMARY_MAX - 1)}…`;
}

/** Track 1 legal block is on for this report (feature + pipeline). */
export function isLegalSummaryScope(report: RiskReport): boolean {
  return (
    report.official.legalEvents !== undefined ||
    report.official.legalRegistryAsOf !== undefined
  );
}

export function hasMatchedLegalEvents(report: RiskReport): boolean {
  return (report.official.legalEvents?.length ?? 0) > 0;
}

/** Public discussion / dispute signal from Track 2 (not legal-only disputeLevel). */
export function hasForumDisputeSignal(report: RiskReport): boolean {
  const highlights = report.signals.highlights ?? [];
  if (highlights.length > 0) return true;

  const bound = report.signals.boundHitCount ?? 0;
  if (bound === 0) return false;

  const level = report.evaluation.reputationTrack.disputeLevel;
  return (
    level === "active_concerning" ||
    level === "severe" ||
    level === "historical_isolated"
  );
}

type HeroSummaryVariant = "neither" | "forum_only" | "legal_only" | "both";

function heroSummaryVariant(report: RiskReport): HeroSummaryVariant {
  const legal = hasMatchedLegalEvents(report);
  const forum = hasForumDisputeSignal(report);
  if (legal && forum) return "both";
  if (legal) return "legal_only";
  if (forum) return "forum_only";
  return "neither";
}

const HERO_COPY: Record<HeroSummaryVariant, string> = {
  neither:
    "根據本次可檢索的公開來源，未有發現與查證對象相關的裝修糾紛討論摘要；在本次已匯入的公開判詞紀錄中，亦未見可對照之案件。資料有限，請自行核實。",
  forum_only:
    "根據本次可檢索的公開來源，檢出與查證對象相關的裝修糾紛或投訴討論摘要，請逐條參考下方來源核實。在本次已匯入的公開判詞紀錄中，未見可對照之案件。",
  legal_only:
    "在本次已匯入的公開判詞紀錄中，有與查證對象對照之案件要點（見下方「公開判詞紀錄」）。本次未檢出相關的公開討論糾紛摘要；不作法律定論。",
  both:
    "本次同時檢出與查證對象相關的公開討論摘要，以及已匯入的公開判詞紀錄要點；請分別核實下方來源與刊憲連結，不作法律定論。",
};

/** Hero「查證摘要」段落：legal 開啟時用四象限文案，否則沿用 LLM summaryZh。 */
export function reportHeroSummaryZh(report: RiskReport): string {
  if (!isLegalSummaryScope(report)) {
    return report.summaryZh;
  }
  return trimHeroSummary(HERO_COPY[heroSummaryVariant(report)]);
}

export type HeroChipTone = "primary" | "warning" | "muted";

/** Track 1 judgments chip label (tone via heroLegalChipTone). */
export function legalRecordsChip(
  report: RiskReport,
): { label: string } | null {
  if (!isLegalSummaryScope(report)) return null;
  const count = report.official.legalEvents?.length ?? 0;
  if (count > 0) {
    return {
      label: count === 1 ? "公開判詞 · 1 宗" : `公開判詞 · ${count} 宗`,
    };
  }
  return { label: "判詞庫未對照" };
}

/** Forum / public discussion chip label (tone via heroForumChipTone). */
export function forumDisputeChip(report: RiskReport): { label: string } {
  if (!hasForumDisputeSignal(report)) {
    return { label: "公開討論：未檢出" };
  }
  const { disputeLevel, recentDisputeCount } =
    report.evaluation.reputationTrack;
  switch (disputeLevel) {
    case "historical_isolated":
      return {
        label:
          recentDisputeCount > 0
            ? `較早提及 · ${recentDisputeCount} 則`
            : "較早公開提及",
      };
    case "active_concerning":
      return {
        label:
          recentDisputeCount > 0
            ? `近期糾紛提及 · ${recentDisputeCount} 則`
            : "近期糾紛提及",
      };
    case "severe":
      return { label: "多宗可引用討論" };
    default:
      return { label: "公開討論提及" };
  }
}

export function heroForumChipTone(
  report: RiskReport,
  disputeTone: HeroChipTone,
): HeroChipTone {
  return hasForumDisputeSignal(report) ? disputeTone : "muted";
}

export function heroLegalChipTone(report: RiskReport): HeroChipTone {
  const count = report.official.legalEvents?.length ?? 0;
  if (count === 0) return "muted";
  const bound = report.signals.boundHitCount ?? 0;
  const events = report.official.legalEvents ?? [];
  const warns = events.some((ev) =>
    legalEventAffectsHeroDisputeWarning(ev, bound),
  );
  return warns ? "warning" : "muted";
}
