import { createHash } from "node:crypto";
import { BD_REGISTERS_CSV_HEADER } from "./csv-header";
import { assertBdRegisterCsvText, decodeBdRegisterCsvBytes } from "./parse";

export class FetchFatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchFatal";
  }
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [5000, 10000, 20000];

export type FetchBdRegisterCsvOptions = {
  userAgent: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export type FetchBdRegisterCsvResult = {
  body: Buffer;
  httpStatus: number;
  contentType: string | null;
  lastModified: string | null;
  etag: string | null;
  url: string;
};

export async function fetchBdRegisterCsv(
  url: string,
  options: FetchBdRegisterCsvOptions,
): Promise<FetchBdRegisterCsvResult> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxRetries = options.maxRetries ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/csv, text/plain, */*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        if (!RETRY_STATUS.has(res.status) || attempt === maxRetries) {
          throw new FetchFatal(`fetch failed ${res.status} ${url}`);
        }
        lastError = new Error(`fetch failed ${res.status}`);
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          body: buf,
          httpStatus: res.status,
          contentType: res.headers.get("content-type"),
          lastModified: res.headers.get("last-modified"),
          etag: res.headers.get("etag"),
          url,
        };
      }
    } catch (e) {
      if (e instanceof FetchFatal) throw e;
      lastError = e;
      if (attempt === maxRetries) break;
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 20_000));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Validate downloaded bytes before writing to cache (no row content in errors). */
export function validateBdRegisterCsvBytes(body: Buffer): void {
  const text = decodeBdRegisterCsvBytes(body);
  assertBdRegisterCsvText(text);
  const firstLine = text.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "").trim() ?? "";
  if (firstLine !== BD_REGISTERS_CSV_HEADER) {
    throw new Error("BD CSV: unexpected content");
  }
}

export function sha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}
