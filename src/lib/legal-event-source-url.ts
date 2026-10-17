/** DEC-0012: judgment source URLs must be HTTPS legalref only. */

const ALLOWED_HOST = "legalref.judiciary.hk";

export function assertLegalrefJudgmentSourceUrl(sourceUrl: string): string {
  const raw = sourceUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`invalid_judgment_source_url: ${raw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`judgment_source_url_must_be_https: ${raw}`);
  }
  if (parsed.hostname !== ALLOWED_HOST) {
    throw new Error(`judgment_source_url_host_not_allowed: ${parsed.hostname}`);
  }
  return raw;
}

export function isLegalrefJudgmentSourceUrl(sourceUrl: string): boolean {
  try {
    assertLegalrefJudgmentSourceUrl(sourceUrl);
    return true;
  } catch {
    return false;
  }
}
