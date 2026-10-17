import type { CauseListCourtCode } from "./types";

export const BACKFILL_COURTS = ["SMT", "DC", "CACFI", "LANDS"] as const;

export const BACKFILL_FROM_ISO = "2024-11-01";

export type CdxRecord = {
  timestamp: string;
  original: string;
  status: string;
};

export type CauseListSnapshot = {
  court: CauseListCourtCode;
  dateDdMmYyyy: string;
  iso: string;
  timestamp: string;
  original: string;
};

export function isoTodayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isoToCompact(iso: string): string {
  return iso.replace(/-/g, "");
}

export function addIsoDays(iso: string, days: number): string {
  const next = new Date(`${iso}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Valid calendar DDMMYYYY → YYYY-MM-DD, otherwise null. */
export function ddMmYyyyToIso(ddmmyyyy: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(ddmmyyyy);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseCdxJson(body: string): CdxRecord[] {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("cdx_empty_body");
  let data: unknown;
  try {
    data = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("cdx_invalid_json");
  }
  if (!Array.isArray(data)) throw new Error("cdx_not_array");
  if (data.length === 0) return [];

  let start = 0;
  let tsIdx = 0;
  let origIdx = 1;
  let statusIdx = 2;
  const first: unknown = data[0];
  if (
    Array.isArray(first) &&
    first.some((cell) => String(cell).toLowerCase() === "timestamp")
  ) {
    const header = first.map((cell) => String(cell).toLowerCase());
    tsIdx = header.indexOf("timestamp");
    origIdx = header.indexOf("original");
    statusIdx = Math.max(header.indexOf("statuscode"), 0);
    start = 1;
  }

  const out: CdxRecord[] = [];
  for (let i = start; i < data.length; i++) {
    const row: unknown = data[i];
    if (!Array.isArray(row)) continue;
    const timestamp = String(row[tsIdx] ?? "");
    const original = String(row[origIdx] ?? "");
    const status = String(row[statusIdx] ?? "");
    if (!/^\d{14}$/.test(timestamp) || !original.startsWith("http")) continue;
    out.push({ timestamp, original, status });
  }
  return out;
}

function isCourt(value: string): value is CauseListCourtCode {
  return (BACKFILL_COURTS as readonly string[]).includes(value);
}

/**
 * One snapshot per court + list date. Archived URLs usually omit `lang`;
 * English is the captured page. Drop explicit non-en lang. Latest timestamp wins.
 */
export function selectCauseListSnapshots(
  records: CdxRecord[],
  fromIso: string,
  toIso: string,
): CauseListSnapshot[] {
  const best = new Map<string, CauseListSnapshot>();
  for (const rec of records) {
    if (rec.status && rec.status !== "200") continue;
    let url: URL;
    try {
      let original = rec.original;
      for (let i = 0; i < 3 && original.includes("&amp;"); i++) {
        original = original.replace(/&amp;/g, "&");
      }
      url = new URL(original);
    } catch {
      continue;
    }
    if (!/^e-services\.judiciary\.hk$/i.test(url.hostname)) continue;
    if (url.pathname !== "/dcl/view.jsp") continue;
    const courtRaw = (url.searchParams.get("court") ?? "").toUpperCase();
    if (!isCourt(courtRaw)) continue;
    const lang = url.searchParams.get("lang");
    if (lang && lang.toLowerCase() !== "en") continue;
    const date = url.searchParams.get("date") ?? "";
    const iso = ddMmYyyyToIso(date);
    if (!iso || iso < fromIso || iso > toIso) continue;
    const snap: CauseListSnapshot = {
      court: courtRaw,
      dateDdMmYyyy: date,
      iso,
      timestamp: rec.timestamp,
      original: rec.original,
    };
    const key = `${courtRaw}|${date}`;
    const prev = best.get(key);
    if (!prev || snap.timestamp > prev.timestamp) best.set(key, snap);
  }

  const order = new Map(BACKFILL_COURTS.map((court, index) => [court, index]));
  return [...best.values()].sort(
    (a, b) =>
      a.iso.localeCompare(b.iso) || (order.get(a.court) ?? 0) - (order.get(b.court) ?? 0),
  );
}

export function snapshotCacheName(snap: CauseListSnapshot): string {
  return `${snap.court}_${snap.dateDdMmYyyy}_wb${snap.timestamp}.html`;
}

/** Inclusive capture window: list dates expanded ±31 days, never past `today`. */
export function cdxCaptureWindow(
  fromIso: string,
  toIso: string,
  today = isoTodayUtc(),
): { fromIso: string; toIso: string } {
  const captureFrom = addIsoDays(fromIso, -31);
  const expandedTo = addIsoDays(toIso, 31);
  const captureTo = expandedTo < today ? expandedTo : today;
  return {
    fromIso: captureFrom,
    toIso: captureTo < captureFrom ? captureFrom : captureTo,
  };
}

export function isNoHearingPage(html: string): boolean {
  return /There is no hearing on this day|此日並無法庭聆訊/.test(html);
}

export function isTransientArchiveHtml(html: string): boolean {
  if (isNoHearingPage(html)) return false;
  if (/has not archived that url/i.test(html)) return true;
  if (/robot access (control|denied)/i.test(html)) return true;
  if (
    /<title>\s*wayback machine\s*<\/title>/i.test(html) &&
    !/daily cause list/i.test(html)
  ) {
    return true;
  }
  if (html.length < 800 && !pageLooksLikeCauseList(html)) return true;
  return false;
}

export function pageLooksLikeCauseList(html: string): boolean {
  return (
    /daily cause list/i.test(html) ||
    /<title>[^<]*daily list/i.test(html) ||
    /每日排期/.test(html)
  );
}

/** Weekdays in range with no CDX date, compressed to inclusive ranges. */
export function weekdayGapRanges(
  fromIso: string,
  toIso: string,
  presentIso: Iterable<string>,
): string[] {
  const present = new Set(presentIso);
  const ranges: string[] = [];
  let gapStart: string | null = null;
  let gapPrev: string | null = null;

  const close = () => {
    if (!gapStart || !gapPrev) return;
    ranges.push(gapStart === gapPrev ? gapStart : `${gapStart}..${gapPrev}`);
    gapStart = null;
    gapPrev = null;
  };

  for (let iso = fromIso; iso <= toIso; iso = addIsoDays(iso, 1)) {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    const weekday = day !== 0 && day !== 6;
    if (!weekday || present.has(iso)) {
      close();
      continue;
    }
    if (!gapStart) gapStart = iso;
    gapPrev = iso;
  }
  close();
  return ranges;
}
