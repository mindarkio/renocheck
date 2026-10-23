import { CR_ESERVICES_URL } from "../report-trust-copy-zh";
import { crStringField } from "./row-fields";
import type { CrApiLocalRow, CrCandidateName } from "./types";
import {
  isIncorporationUnderOneYearAt,
  parseCrIncorporationDateToIso,
} from "./parse-date";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function mapCrApiRowToSnapshot(
  row: CrApiLocalRow,
  opts: {
    matchTier: "A" | "B" | "C";
    retrievedAt: string;
  },
): Omit<
  import("./types").CrMappedSnapshot,
  "matched" | "matchAmbiguous"
> {
  let incorporationDate = parseCrIncorporationDateToIso(
    row.Date_of_Incorporation,
  );
  if (incorporationDate && !ISO_DATE.test(incorporationDate)) {
    incorporationDate = undefined;
  }
  const hints: Array<"incorporation_under_one_year" | "not_found_in_active_list"> =
    [];
  if (
    incorporationDate &&
    isIncorporationUnderOneYearAt(incorporationDate, opts.retrievedAt)
  ) {
    hints.push("incorporation_under_one_year");
  }
  const nameZhRaw = crStringField(row.Chinese_Company_Name);
  const nameZh =
    nameZhRaw && nameZhRaw !== "NULL" ? nameZhRaw : undefined;
  const nameEnRaw = crStringField(row.English_Company_Name) || undefined;
  const brNo = crStringField(row.Brn);
  const companyType = crStringField(row.Company_Type);
  return {
    matchTier: opts.matchTier,
    brNo: brNo ? brNo.slice(0, 32) : undefined,
    companyType: companyType ? companyType.slice(0, 120) : undefined,
    nameZh: nameZh?.slice(0, 200),
    nameEn: nameEnRaw?.slice(0, 200),
    incorporationDate,
    retrievedAt: opts.retrievedAt,
    hints,
    icrisHomeUrl: CR_ESERVICES_URL,
  };
}

export function notFoundCrSnapshot(retrievedAt: string): import("./types").CrMappedSnapshot {
  return {
    matched: false,
    retrievedAt,
    hints: ["not_found_in_active_list"],
    icrisHomeUrl: CR_ESERVICES_URL,
  };
}

export function ambiguousCrSnapshot(
  retrievedAt: string,
): import("./types").CrMappedSnapshot {
  return {
    matched: false,
    matchAmbiguous: true,
    retrievedAt,
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
  };
}

export function inconclusiveCrSnapshot(
  retrievedAt: string,
): import("./types").CrMappedSnapshot {
  return {
    matched: false,
    retrievedAt,
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
  };
}

function candidateNameFromRow(row: CrApiLocalRow): CrCandidateName | null {
  const nameZhRaw = crStringField(row.Chinese_Company_Name);
  const nameZh =
    nameZhRaw && nameZhRaw !== "NULL" ? nameZhRaw.slice(0, 200) : undefined;
  const nameEnRaw = crStringField(row.English_Company_Name);
  const nameEn =
    nameEnRaw && nameEnRaw !== "NULL" ? nameEnRaw.slice(0, 200) : undefined;
  const brRaw = crStringField(row.Brn);
  const brNo = brRaw ? brRaw.slice(0, 32) : undefined;
  if (!nameZh && !nameEn && !brNo) return null;
  return {
    ...(brNo ? { brNo } : {}),
    ...(nameZh ? { nameZh } : {}),
    ...(nameEn ? { nameEn } : {}),
  };
}

/** Grade D snapshot. `matched` stays false. Null when the rows have no display fields. */
export function candidateCrSnapshot(
  rows: CrApiLocalRow[],
  retrievedAt: string,
): import("./types").CrMappedSnapshot | null {
  const candidateNames = rows
    .map(candidateNameFromRow)
    .filter((name): name is CrCandidateName => name !== null)
    .slice(0, 2);
  if (candidateNames.length === 0) return null;
  return {
    matched: false,
    retrievedAt,
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
    candidateNames,
  };
}
