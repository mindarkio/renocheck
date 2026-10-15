/** Parse BD register CSV date DD/MM/YYYY → ISO date (YYYY-MM-DD). */
export function parseBdRegistryExpiryDate(raw: string): string | null {
  const s = raw.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const year = Number.parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const probe = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(probe.getTime())) return null;
  return iso;
}

/** User-facing expiry from ISO date (HKT calendar). */
export function formatMwcExpiryDateZh(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return isoDate;
  return `${y}年${m}月${d}日`;
}

export function isMwcExpiryBeforeReport(
  expiryIsoDate: string,
  reportGeneratedAtIso: string,
): boolean {
  const expiry = new Date(`${expiryIsoDate}T23:59:59+08:00`).getTime();
  const generated = new Date(reportGeneratedAtIso).getTime();
  return expiry < generated;
}
