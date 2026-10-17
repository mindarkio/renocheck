import path from "node:path";

export const BD_REGISTER_CACHE_DIR = path.join(
  process.cwd(),
  ".cache",
  "bd-register",
);

/** Latest fetch from DATA.GOV (used by import:mwc and dry-run candidate). */
export const BD_REGISTER_CSV_PATH = path.join(
  BD_REGISTER_CACHE_DIR,
  "registers_full_list.csv",
);

/** Frozen snapshot for MWC dry-run baseline (copy from candidate after fetch). */
export const BD_REGISTER_BASELINE_CSV_PATH = path.join(
  BD_REGISTER_CACHE_DIR,
  "registers_full_list.baseline.csv",
);

export const BD_REGISTER_META_PATH = path.join(
  BD_REGISTER_CACHE_DIR,
  "registers_full_list.meta.json",
);
