/** API `Date_of_Incorporation` is `DD-MM-YYYY`. */
export function parseCrIncorporationDateToIso(raw: string): string | undefined {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim());
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return iso;
}

export function isIncorporationUnderOneYearAt(
  incorporationDateIso: string,
  retrievedAtIso: string,
): boolean {
  const inc = new Date(`${incorporationDateIso}T00:00:00.000Z`);
  const at = new Date(retrievedAtIso);
  if (Number.isNaN(inc.getTime()) || Number.isNaN(at.getTime())) return false;
  const ms = at.getTime() - inc.getTime();
  if (ms < 0) return false;
  return ms < 365 * 24 * 60 * 60 * 1000;
}
