import { defendantHasEngineeringKeyword } from "./judgment-d2-case-policy";
import type { classifyDefendantEntity } from "./judgment-d2-entity";
import { caseRefPrefix } from "./judgment-d2-parties";
import { partyIsEngineeringCompany } from "./judgment-d2-v3d-rules";

type DefendantEntityKind = ReturnType<typeof classifyDefendantEntity>;

export function isLabourRenovationCandidate(input: {
  caseRef: string;
  defendantLabel: string;
  entityKind: DefendantEntityKind;
}): boolean {
  if (caseRefPrefix(input.caseRef) !== "HCLA") return false;
  if (input.entityKind !== "company") return false;
  const label = input.defendantLabel.trim();
  return (
    defendantHasEngineeringKeyword(label) || partyIsEngineeringCompany(label)
  );
}

export function labourJudgmentRenovationContext(plainText: string): {
  ok: boolean;
  chainSignals: string[];
  worksSignals: string[];
} {
  const chainRe =
    /第\s*43C\s*條|43C|43F|總承判商|次承判商|次次要承判商|大判|二判|三判|判頭|分判|principal contractor|sub-?contractor/giu;
  const worksRe =
    /地盤|工地|裝修工程|翻新工程|維修工程|改建工程|建造工程|建築工程|building works|renovation|fitting[- ]out|construction site/giu;
  const chainSignals = [...plainText.matchAll(chainRe)].map((m) => m[0]!);
  const worksSignals = [...plainText.matchAll(worksRe)].map((m) => m[0]!);
  return {
    ok: chainSignals.length >= 1 && worksSignals.length >= 1,
    chainSignals,
    worksSignals,
  };
}
