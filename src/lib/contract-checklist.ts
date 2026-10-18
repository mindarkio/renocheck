/** Signing checklist in LLM pipeline output (legacy field; UI uses DEFAULT_CONTRACT_CHECKLIST_ZH). */
export function defaultContractChecklist(): string[] {
  return [
    "工程範圍、物料品牌與單價是否寫清？",
    "付款期數是否與工程進度掛鈎？",
    "保養期、延誤責任與終止合約條款是否明確？",
  ];
}
