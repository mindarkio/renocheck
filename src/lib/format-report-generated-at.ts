const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Fixed pattern for SSR/client match (avoids locale hydration drift). */
export function formatReportGeneratedAtHkt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hkt = new Date(d.getTime() + HKT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hkt.getUTCFullYear()}-${pad(hkt.getUTCMonth() + 1)}-${pad(hkt.getUTCDate())} ${pad(hkt.getUTCHours())}:${pad(hkt.getUTCMinutes())} (HKT)`;
}
