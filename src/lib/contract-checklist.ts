import { DEFAULT_CONTRACT_CHECKLIST_ZH } from "./report-trust-copy-zh";

/** Signing checklist shown on every report (open access). */
export function defaultContractChecklist(): string[] {
  return [...DEFAULT_CONTRACT_CHECKLIST_ZH];
}
