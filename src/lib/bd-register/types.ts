export type BdRegisterEntry = {
  registerType: string;
  regNo: string;
  /** Omitted for individual (MWC(W)) rows — regNo only. */
  nameEn?: string;
  nameZh?: string;
  expiryDate?: string;
  status?: string;
};
