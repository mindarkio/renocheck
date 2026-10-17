export type CauseListCourtCode = "SMT" | "DC" | "CACFI" | "LANDS";

export type CauseListPartyRole =
  | "claimant"
  | "defendant"
  | "plaintiff"
  | "respondent"
  | "applicant"
  | "unknown";

export type CauseListParty = {
  role: CauseListPartyRole;
  /** D1, P2, etc. when present */
  position?: string;
  rawName: string;
};

export type ParsedCauseListCase = {
  court: CauseListCourtCode;
  caseNo: string;
  hearingDate: string;
  claimNature?: string;
  hearingType?: string;
  parties: CauseListParty[];
};

export type ParsedCorporateParty = {
  role: CauseListPartyRole;
  position?: string;
  rawName: string;
  legalName: string;
  tradeName?: string;
  formerlyTradedAs?: boolean;
  incorporatedOwners?: boolean;
};

export type MatchConfidence = "A" | "B" | "C";

export type CauseListMatch = {
  confidence: MatchConfidence;
  companyId: string;
  case: ParsedCauseListCase;
  party: ParsedCorporateParty;
  matchedOn: string;
  reviewOnly: boolean;
};
