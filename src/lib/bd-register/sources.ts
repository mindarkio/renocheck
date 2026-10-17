/** DATA.GOV.HK PSI — Buildings Department registers full list (CSV). */
export const BD_REGISTERS_FULL_LIST_CSV_URL =
  "https://static.data.gov.hk/bd/opendata/registers/registers_full_list.csv";

export const BD_REGISTERS_DATASET_PAGE =
  "https://data.gov.hk/tc-data/dataset/hk-bd-opendata-registers-of-buildings-department";

export const BD_REGISTERS_UPDATE_FREQUENCY = "Every Monday and Thursday";

/** Contractor register types parsed in Phase 4 (subset of REGISTRATION_TYPE). */
export const BD_CONTRACTOR_REGISTER_TYPES = new Set([
  "MWC",
  "MWC(W)",
  "GBC",
  "SC(D)",
  "SC(F)",
  "SC(SF)",
  "SC(V)",
  "SC(GI)",
]);

export function isBdContractorRegisterType(registrationType: string): boolean {
  return BD_CONTRACTOR_REGISTER_TYPES.has(registrationType.trim());
}

export function isBdIndividualContractorType(registrationType: string): boolean {
  return registrationType.trim() === "MWC(W)";
}
