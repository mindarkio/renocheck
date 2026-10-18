import {
  isCrCircuitOpen,
  recordCrApiFailure,
  recordCrApiSuccess,
} from "./circuit-breaker";
import { scheduleCrApiRequest } from "./throttle";
import type { CrApiLocalRow } from "./types";

const LOCAL_SEARCH_URL =
  "https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search";

const MAX_BODY_BYTES = 2_000_000;

export type CrLocalSearchResult =
  | { kind: "rows"; rows: CrApiLocalRow[] }
  | { kind: "no_result" }
  | { kind: "error"; message: string };

export type CrFetchOptions = {
  signal?: AbortSignal;
};

function buildSearchUrl(
  key1: string,
  key2: string,
  key3: string,
): string {
  const params = new URLSearchParams();
  params.set("query[0][key1]", key1);
  params.set("query[0][key2]", key2);
  params.set("query[0][key3]", key3);
  params.set("format", "json");
  return `${LOCAL_SEARCH_URL}?${params.toString()}`;
}

function parseNoResultMessage(body: unknown, httpStatus: number): boolean {
  if (httpStatus !== 400) return false;
  if (typeof body !== "object" || body === null) return false;
  const o = body as { status?: number; message?: string };
  if (o.status !== 400) return false;
  const msg = (o.message ?? "").trim();
  return /^no result found\.?$/i.test(msg);
}

async function fetchLocalSearch(
  key1: string,
  key2: string,
  key3: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  if (isCrCircuitOpen()) {
    return { kind: "error", message: "circuit_open" };
  }

  const scheduled = await scheduleCrApiRequest(async () => {
    const url = buildSearchUrl(key1, key2, key3);
    try {
      const res = await fetch(url, {
        signal: options?.signal,
        headers: { Accept: "application/json" },
      });
      const len = res.headers.get("content-length");
      if (len && Number.parseInt(len, 10) > MAX_BODY_BYTES) {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: "too_large" };
      }
      const text = await res.text();
      if (text.length > MAX_BODY_BYTES) {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: "too_large" };
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: "invalid_json" };
      }
      if (res.status === 429) {
        recordCrApiFailure(429, res.headers.get("retry-after"));
        return { kind: "error" as const, message: "http_429" };
      }
      if (parseNoResultMessage(body, res.status)) {
        recordCrApiSuccess();
        return { kind: "no_result" as const };
      }
      if (res.status === 400) {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: "http_400" };
      }
      if (!res.ok) {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: `http_${res.status}` };
      }
      if (
        typeof body === "object" &&
        body !== null &&
        "status" in body &&
        (body as { status?: number }).status === 400
      ) {
        recordCrApiFailure(200);
        return { kind: "error" as const, message: "body_status_400" };
      }
      if (!Array.isArray(body)) {
        recordCrApiFailure(res.status);
        return { kind: "error" as const, message: "unexpected_shape" };
      }
      recordCrApiSuccess();
      return { kind: "rows" as const, rows: body as CrApiLocalRow[] };
    } catch (e) {
      const msg = e instanceof Error ? e.name : "fetch_failed";
      recordCrApiFailure(0);
      if (msg === "TimeoutError" || msg === "AbortError") {
        return { kind: "error" as const, message: "timeout" };
      }
      return { kind: "error" as const, message: "fetch_failed" };
    }
  });

  if (!scheduled.ok) {
    return { kind: "error", message: scheduled.reason };
  }
  return scheduled.value;
}

export async function searchCrLocalByBrnEqual(
  brn: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  return fetchLocalSearch("Brn", "equal", brn.trim(), options);
}

export async function searchCrLocalByNameBeginsWith(
  prefix: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  const p = prefix.trim();
  if (!p) return { kind: "no_result" };
  return fetchLocalSearch("Comp_name", "begins_with", p, options);
}
