import { CR_ESERVICES_URL } from "../report-trust-copy-zh";
import type { CrApiLocalRow } from "./types";
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
  const nameZhRaw =
    row.Chinese_Company_Name &&
    row.Chinese_Company_Name !== "NULL" &&
    row.Chinese_Company_Name.trim()
      ? row.Chinese_Company_Name.trim()
      : undefined;
  const nameEnRaw = row.English_Company_Name?.trim() || undefined;
  return {
    matchTier: opts.matchTier,
    brNo: row.Brn?.trim().slice(0, 32) || undefined,
    companyType: row.Company_Type?.trim().slice(0, 120) || undefined,
    nameZh: nameZhRaw?.slice(0, 200),
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
