import type { z } from "zod";
import type { RiskReport, gradeSchema, disputeLevelSchema } from "./report-schema";
import type { OfficialLegalEvent, JudgmentCategory } from "./legal-event-schema";
import {
  dedupeByJudgment,
  strongestCategory,
} from "./lookup-legal-judgments";
import type { riskBandZhSchema } from "./report-schema";

type Grade = z.infer<typeof gradeSchema>;
type RiskBandZh = z.infer<typeof riskBandZhSchema>;
type DisputeLevel = z.infer<typeof disputeLevelSchema>;

const BAND_SEVERITY: Record<RiskBandZh, number> = {
  中性: 0,
  未見負面摘要: 0,
  風險中等: 1,
  風險偏高: 2,
};

const DISPUTE_SEVERITY: Record<DisputeLevel, number> = {
  none_detected: 0,
  historical_isolated: 1,
  active_concerning: 2,
  severe: 3,
};

const GRADE_SEVERITY: Record<Grade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
};

const DEFENDANT_FLOOR_CATEGORIES = new Set<JudgmentCategory>([
  "renovation_engineering_civil",
  "building_defect_water_damage",
  "arbitration_award",
  "small_claims_debt",
  "general_contract_debt",
  "small_works_regulatory",
  "criminal_regulatory",
  "winding_up_insolvency",
  "personal_injury_site",
  "employment_renovation",
]);

const CATEGORY_BASE: Partial<
  Record<JudgmentCategory, { band: RiskBandZh; dispute: DisputeLevel }>
> = {
  renovation_engineering_civil: {
    band: "風險中等",
    dispute: "active_concerning",
  },
  building_defect_water_damage: {
    band: "風險中等",
    dispute: "active_concerning",
  },
  arbitration_award: { band: "風險中等", dispute: "active_concerning" },
  small_claims_debt: { band: "風險中等", dispute: "active_concerning" },
  general_contract_debt: { band: "風險中等", dispute: "active_concerning" },
  small_works_regulatory: {
    band: "風險中等",
    dispute: "active_concerning",
  },
  criminal_regulatory: { band: "風險中等", dispute: "active_concerning" },
  winding_up_insolvency: { band: "風險中等", dispute: "active_concerning" },
  personal_injury_site: { band: "風險中等", dispute: "active_concerning" },
  employment_renovation: {
    band: "風險中等",
    dispute: "active_concerning",
  },
  employment_labour: { band: "中性", dispute: "historical_isolated" },
  landlord_tenant: { band: "中性", dispute: "historical_isolated" },
  intellectual_property: { band: "中性", dispute: "none_detected" },
  defamation: { band: "中性", dispute: "none_detected" },
  other_civil: { band: "中性", dispute: "historical_isolated" },
};

function downgradeBand(band: RiskBandZh): RiskBandZh {
  if (band === "風險偏高") return "風險中等";
  if (band === "風險中等") return "中性";
  return band;
}

function yearsSince(eventDate: string, anchorIso: string): number {
  const end = new Date(anchorIso).getTime();
  const start = new Date(eventDate).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return 0;
  return (end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

function eventContributesFloor(
  ev: OfficialLegalEvent,
  boundHitCount: number,
): { band: RiskBandZh; dispute: DisputeLevel } | null {
  if (ev.outcomeHint === "defendant_not_liable") return null;
  if (ev.outcomeHint === "procedural_only") return null;
  if (ev.partyRole === "plaintiff") return null;
  if (ev.partyRole !== "defendant") return null;

  if (ev.judgmentCategory === "employment_renovation") {
    if (ev.outcomeHint !== "defendant_liable" && ev.outcomeHint !== "partial") {
      return null;
    }
    return { band: "風險中等", dispute: "active_concerning" };
  }

  const base = CATEGORY_BASE[ev.judgmentCategory];
  if (!base) return null;

  if (
    boundHitCount === 0 &&
    !DEFENDANT_FLOOR_CATEGORIES.has(ev.judgmentCategory)
  ) {
    return null;
  }

  let band = base.band;
  let dispute = base.dispute;

  if (ev.outcomeHint === "unclear") {
    band = downgradeBand(band);
    if (band === "中性") dispute = "historical_isolated";
  }

  if (
    ev.procedureStage === "interlocutory" ||
    ev.procedureStage === "hearing_only"
  ) {
    band = downgradeBand(band);
  }

  return { band, dispute };
}

function mergeBand(current: RiskBandZh, floor: RiskBandZh): RiskBandZh {
  return BAND_SEVERITY[floor] > BAND_SEVERITY[current] ? floor : current;
}

function mergeDispute(current: DisputeLevel, floor: DisputeLevel): DisputeLevel {
  return DISPUTE_SEVERITY[floor] > DISPUTE_SEVERITY[current]
    ? floor
    : current;
}

function gradeFloorForBand(band: RiskBandZh): Grade | null {
  if (band === "風險偏高") return "D";
  if (band === "風險中等") return "C";
  return null;
}

function maxGrade(a: Grade, b: Grade): Grade {
  return GRADE_SEVERITY[a] >= GRADE_SEVERITY[b] ? a : b;
}

export function computeLegalFloors(
  events: OfficialLegalEvent[],
  boundHitCount: number,
  generatedAt: string,
): { riskBandZh: RiskBandZh; disputeLevel: DisputeLevel } | null {
  const deduped = dedupeByJudgment(events);
  let band: RiskBandZh = "中性";
  let dispute: DisputeLevel = "none_detected";
  let any = false;

  const recentAgainst = deduped.filter((ev) => {
    if (ev.outcomeHint !== "defendant_liable") return false;
    if (yearsSince(ev.eventDate, generatedAt) > 5) return false;
    const c = eventContributesFloor(ev, boundHitCount);
    return c !== null && BAND_SEVERITY[c.band] >= BAND_SEVERITY["風險中等"];
  });

  for (const ev of deduped) {
    const contrib = eventContributesFloor(ev, boundHitCount);
    if (!contrib) continue;
    any = true;

    let { band: evBand, dispute: evDispute } = contrib;

    if (yearsSince(ev.eventDate, generatedAt) > 10) {
      evBand = mergeBand(evBand, "風險中等");
      if (BAND_SEVERITY[evBand] > BAND_SEVERITY["風險中等"]) {
        evBand = "風險中等";
      }
      evDispute = mergeDispute(evDispute, "historical_isolated");
      if (DISPUTE_SEVERITY[evDispute] > DISPUTE_SEVERITY.historical_isolated) {
        evDispute = "historical_isolated";
      }
    }

    band = mergeBand(band, evBand);
    dispute = mergeDispute(dispute, evDispute);
  }

  if (recentAgainst.length >= 2) {
    band = mergeBand(band, "風險偏高");
    dispute = mergeDispute(dispute, "active_concerning");
    any = true;
  }

  if (!any) return null;
  return { riskBandZh: band, disputeLevel: dispute };
}

export function applyLegalEventFloors(
  report: RiskReport,
  events: OfficialLegalEvent[],
  boundHitCount: number,
): RiskReport {
  if (events.length === 0) return report;

  const deduped = dedupeByJudgment(events);

  const floors = computeLegalFloors(
    deduped,
    boundHitCount,
    report.generatedAt,
  );
  if (!floors) {
    return {
      ...report,
      evaluation: {
        ...report.evaluation,
        legalTrack: {
          matchedCount: deduped.length,
          strongestCategory: strongestCategory(deduped),
        },
      },
    };
  }

  const nextBand = mergeBand(report.evaluation.riskBandZh, floors.riskBandZh);
  const nextDispute = mergeDispute(
    report.evaluation.reputationTrack.disputeLevel,
    floors.disputeLevel,
  );

  let grade = report.grade;
  const gradeFloor = gradeFloorForBand(nextBand);
  if (gradeFloor) {
    grade = maxGrade(grade, gradeFloor);
  }

  return {
    ...report,
    grade,
    evaluation: {
      ...report.evaluation,
      overallGrade: grade,
      displayGradeZh: grade,
      riskBandZh: nextBand,
      reputationTrack: {
        ...report.evaluation.reputationTrack,
        disputeLevel: nextDispute,
      },
      legalTrack: {
        matchedCount: deduped.length,
        strongestCategory: strongestCategory(deduped),
      },
    },
  };
}
