/** Names stored from one BD register CSV row. Pure; no database or env access. */

export type MwcSourceNameFields = {
  CHINESE_COMPANY_NAME?: string;
  ENGLISH_COMPANY_NAME?: string;
  CHINESE_NAME?: string;
  ENGLISH_NAME?: string;
  REGISTRATION_NUMBER?: string;
};

export type MwcStoredNames = {
  /** Chinese-first display name. Same preference order as the historical importer. */
  company_name: string;
  /** English company or contractor name. Null when the source row has none. */
  company_name_en: string | null;
};

function stripHtml(value: string): string {
  return value.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

export function mwcStoredNames(row: MwcSourceNameFields): MwcStoredNames {
  const zhCompany = stripHtml(row.CHINESE_COMPANY_NAME ?? "");
  const enCompany = stripHtml(row.ENGLISH_COMPANY_NAME ?? "");
  const zhPerson = stripHtml(row.CHINESE_NAME ?? "");
  const enPerson = stripHtml(row.ENGLISH_NAME ?? "");
  const company_name =
    zhCompany ||
    enCompany ||
    zhPerson ||
    enPerson ||
    row.REGISTRATION_NUMBER?.trim() ||
    "Unknown";
  const english = enCompany || enPerson;
  return {
    company_name,
    company_name_en: english ? english : null,
  };
}
