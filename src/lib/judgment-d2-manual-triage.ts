/** Human triage overrides (deterministic; ref-keyed). */

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
  "CACV131/2005": "manual_triage_no_verified_summary",
  "DCCJ3800/2013": "manual_triage_no_verified_summary",
  "DCCJ18510/2001": "manual_triage_no_verified_summary",
  "DCCJ2220/2002": "manual_triage_no_verified_summary",
  "HCA2269/2007": "manual_triage_no_verified_summary",
  "LDBM6/1998": "manual_triage_no_verified_summary",
  "HCSA40/2023": "manual_triage_no_verified_summary",
  "HCA714/2007": "manual_triage_no_verified_summary",
  "DCCJ3255/2004": "manual_triage_no_verified_summary",
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
