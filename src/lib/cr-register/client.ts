import { scheduleCrApiRequest } from "./throttle";
import type { CrApiLocalRow } from "./types";

const LOCAL_SEARCH_URL =
  "https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search";

const FETCH_TIMEOUT_MS = 5000;

export type CrLocalSearchResult =
  | { kind: "rows"; rows: CrApiLocalRow[] }
  | { kind: "no_result" }
  | { kind: "error"; message: string };

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

async function fetchLocalSearch(
  key1: string,
  key2: string,
  key3: string,
): Promise<CrLocalSearchResult> {
  return scheduleCrApiRequest(async () => {
    const url = buildSearchUrl(key1, key2, key3);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return { kind: "error", message: "invalid_json" };
      }
      if (
        typeof body === "object" &&
        body !== null &&
        "status" in body &&
        (body as { status?: number }).status === 400
      ) {
        return { kind: "no_result" };
      }
      if (!res.ok) {
        return { kind: "error", message: `http_${res.status}` };
      }
      if (!Array.isArray(body)) {
        return { kind: "error", message: "unexpected_shape" };
      }
      return { kind: "rows", rows: body as CrApiLocalRow[] };
    } catch (e) {
      const msg = e instanceof Error ? e.name : "fetch_failed";
      if (msg === "TimeoutError" || msg === "AbortError") {
        return { kind: "error", message: "timeout" };
      }
      return { kind: "error", message: "fetch_failed" };
    }
  });
}

export async function searchCrLocalByBrnEqual(
  brn: string,
): Promise<CrLocalSearchResult> {
  return fetchLocalSearch("Brn", "equal", brn.trim());
}

export async function searchCrLocalByNameBeginsWith(
  prefix: string,
): Promise<CrLocalSearchResult> {
  const p = prefix.trim();
  if (!p) return { kind: "no_result" };
  return fetchLocalSearch("Comp_name", "begins_with", p);
}
