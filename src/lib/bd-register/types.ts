export type BdRegisterEntry = {
  registerType: string;
  regNo: string;
  /** Omitted for individual (MWC(W)) and unincorporated rows — regNo only. */
  nameEn?: string;
  nameZh?: string;
  normStrictEn?: string;
  normStrictZh?: string;
  normCoreEn?: string;
  normCoreZh?: string;
  expiryDate?: string;
  /** Raw FLAG column (other than `@`). */
  flag?: string;
  /** FLAG `@` — renewal applied; registration remains valid past expiry until processed. */
  renewalPending?: boolean;
  /** Non-limited / sole-prop style registration — no company names in output. */
  unincorporated?: boolean;
};

export type BdParseResult = {
  entries: BdRegisterEntry[];
  /** Contractor rows before de-duplication by type|regNo. */
  rawContractorRows: number;
};
