/** Raw API row — pipeline only; never cache or log. */
export type CrApiLocalRow = {
  Brn: string;
  Chinese_Company_Name: string;
  English_Company_Name: string;
  Address_of_Registered_Office: string;
  Company_Type: string;
  Date_of_Incorporation: string;
  "Re-domiciliation_Date"?: string | null;
};

export type CrApiNoResult = {
  status: number;
  message: string;
};

export type CrCandidateName = {
  brNo?: string;
  nameZh?: string;
  nameEn?: string;
};

export type CrMappedSnapshot = {
  matched: boolean;
  matchAmbiguous?: boolean;
  matchTier?: "A" | "B" | "C";
  brNo?: string;
  companyType?: string;
  nameZh?: string;
  nameEn?: string;
  incorporationDate?: string;
  retrievedAt: string;
  hints: Array<"incorporation_under_one_year" | "not_found_in_active_list">;
  icrisHomeUrl: string;
  /** Grade D only. Not a match and not a grade input. */
  candidateNames?: CrCandidateName[];
};
