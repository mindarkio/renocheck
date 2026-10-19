/** Human triage overrides (deterministic; ref-keyed). */

import { createHash } from "node:crypto";
import { normalizeCaseRefKey } from "./judgment-d2-v3d-rules";

export type ManualKeepOverride = {
  defendantLabel: string;
  plaintiffLabel?: string;
  lookupAliases?: string[];
  /** Import as sole_proprietorship topic + badge. */
  soleProprietorship?: boolean;
};

const MANUAL_DROP: Record<string, string> = {
  "LDBM85/2011": "manual_triage_defendant_natural_person_or_io",
  "LDBM232/2010": "manual_triage_defendant_natural_person_or_io",
  "LDBM191/2011": "manual_triage_defendant_natural_person_or_io",
  "HCB6709/2024": "manual_triage_bankruptcy",
  "HCB6115/2010": "manual_triage_bankruptcy",
  "HCB4042/2011": "manual_triage_bankruptcy",
  "CACV339/2005": "manual_triage_bankruptcy",
  "DCCJ797/2003": "manual_triage_plaintiff_not_defendant",
  "CACV593/2020": "defendant_work_injury_context",
  "CACV131/2005": "manual_triage_io_maintenance_fee_recovery_from_owners",
  "DCCJ3800/2013": "manual_triage_defendant_mainland_geotech_not_renovation",
  "DCCJ18510/2001": "manual_triage_general_contractor_as_plaintiff",
  "DCCJ2220/2002": "manual_triage_defendant_marine_freight_not_renovation",
  "HCA2269/2007": "manual_triage_individual_plaintiff_vs_contractor",
  "LDBM6/1998": "manual_triage_defendant_contractor_is_owner_in_case",
  "HCSA40/2023": "manual_triage_hcsa_appeal_leave_order_only",
  "HCA714/2007": "manual_triage_defendant_developer_contractor_out_of_scope",
  "DCCJ3255/2004": "manual_triage_defendant_interior_design_not_renovation",
};

const MANUAL_KEEP: Record<string, ManualKeepOverride> = {
  "DCCJ5003/2019": {
    plaintiffLabel:
      "CHONG KEI SHU t/a TAT SHING CIVIL ENGINEERING CO（達成土木工程公司）",
    defendantLabel:
      "李志祥及潘欣怡經營HOMELAND CIVIL ENGINEERING COMPANY（木子水禾田工程公司）",
    lookupAliases: [
      "HOMELAND CIVIL ENGINEERING COMPANY",
      "木子水禾田工程公司",
      "HOMELAND CIVIL ENGINEERING",
    ],
    soleProprietorship: true,
  },
};

export function manualDropReason(caseRef: string): string | null {
  const key = normalizeCaseRefKey(caseRef);
  return MANUAL_DROP[key] ?? null;
}

export function manualKeepOverride(caseRef: string): ManualKeepOverride | null {
  const key = normalizeCaseRefKey(caseRef);
  return MANUAL_KEEP[key] ?? null;
}

const LABOUR_RENOVATION_VERIFIED = new Set(
  ["HCLA23/2024", "HCLA24/2024", "HCLA25/2024", "HCLA26/2024"].map(
    normalizeCaseRefKey,
  ),
);
// [2025] HKCFI 633 — 2026-10-19 核對原文：裝修工程、總承判商／次承判商、《僱傭條例》第43C條

export function isLabourRenovationVerified(caseRef: string): boolean {
  return LABOUR_RENOVATION_VERIFIED.has(normalizeCaseRefKey(caseRef));
}

/** Bumps D2 step cache when MANUAL_DROP / MANUAL_KEEP change. */
export function manualTriageRevisionHash(): string {
  const payload = JSON.stringify({
    drop: Object.entries(MANUAL_DROP).sort(([a], [b]) => a.localeCompare(b)),
    keep: Object.entries(MANUAL_KEEP).sort(([a], [b]) => a.localeCompare(b)),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
