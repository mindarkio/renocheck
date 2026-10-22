const OUTCOME_LABELS: Record<string, string> = {
  match: "完全吻合",
  mwc_authoritative: "名唔同但搵到",
  ambiguous: "撞名多間",
  user_only: "搵唔到",
};

export function outcomeLabelZh(outcome: string | null | undefined): string {
  if (!outcome) return "未知";
  return OUTCOME_LABELS[outcome] ?? "未知";
}
