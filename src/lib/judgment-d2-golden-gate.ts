/**
 * Opt-in gate and narrow MWC read for the D2 filter golden parity test.
 * `decideD2GoldenRun` is pure. The loader talks only to the client it is given.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MwcRow } from "./mwc-lookup";

/** Read-only key. Service role is never accepted. */
export const D2_GOLDEN_ANON_KEY_ENV_NAMES = ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/** Columns the golden read may select. No personal-name or phone columns. */
export const D2_GOLDEN_MWC_COLUMNS = ["company_name", "registration_no"] as const;

/** Hosted production project. Always refused unless the read-only allow flag is set. */
export const DEFAULT_SUPABASE_PROD_PROJECT_REFS = ["lvrasvtilgzwtfsfjbzd"] as const;

export const D2_GOLDEN_MIN_MWC_ROWS = 1000;

export const D2_GOLDEN_RUN_ENV = "RUN_D2_GOLDEN";
export const D2_GOLDEN_PROD_REFS_ENV = "SUPABASE_PROD_PROJECT_REFS";

/** Shown for SQLSTATE 42501 / permission denied. Never include row text. */
export const D2_MWC_ANON_DENIED_MESSAGE =
  "anon 讀唔到 mwc_contractors：D2 要用 local／dev DB";

export type D2GoldenEnv = Record<string, string | undefined>;

export type D2GoldenDecision =
  | { action: "run" }
  | { action: "skip"; reason: string }
  | { action: "fail"; reason: string };

export type D2GoldenKeyChoice =
  | { ok: true; key: string; source: "anon" }
  | { ok: false; reason: string };

const SUPABASE_PROJECT_HOST = /^(?:db\.)?([a-z0-9]+)\.supabase\.co$/i;
const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type D2MwcNameRow = {
  company_name: string | null;
  registration_no: string | null;
};

type D2MwcPageError = {
  code?: string | null;
  message?: string | null;
};

type D2MwcPage = {
  data: D2MwcNameRow[] | null;
  error: D2MwcPageError | null;
  count: number | null;
};

export function supabaseProjectRefFromUrl(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  let hostname: string;
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    return null;
  }
  const match = hostname.match(SUPABASE_PROJECT_HOST);
  return match?.[1]?.toLowerCase() ?? null;
}

export function parseSupabaseProdProjectRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const part of raw.split(",")) {
    const ref = part.trim().toLowerCase();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

export function d2GoldenProdProjectRefs(env: D2GoldenEnv): string[] {
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const ref of [
    ...DEFAULT_SUPABASE_PROD_PROJECT_REFS,
    ...parseSupabaseProdProjectRefs(env[D2_GOLDEN_PROD_REFS_ENV]),
  ]) {
    const normalized = ref.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    refs.push(normalized);
  }
  return refs;
}

function flagOn(env: D2GoldenEnv, name: string): boolean {
  return env[name]?.trim() === "1";
}

function supabaseUrl(env: D2GoldenEnv): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim() || undefined;
}

export function d2GoldenMwcSelectList(): string {
  return D2_GOLDEN_MWC_COLUMNS.join(", ");
}

/**
 * Fail closed when the URL is missing, not a known host, or a production project ref.
 * Production is always refused. Localhost and non-prod `*.supabase.co` refs may run.
 */
export function decideD2MwcDatabase(env: D2GoldenEnv): D2GoldenDecision {
  const rawUrl = supabaseUrl(env);
  if (!rawUrl) {
    return {
      action: "fail",
      reason:
        "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is missing. D2 要用 local／dev DB。",
    };
  }

  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return { action: "fail", reason: "Invalid Supabase URL." };
  }

  if (LOCAL_SUPABASE_HOSTS.has(hostname)) {
    return { action: "run" };
  }

  const ref = supabaseProjectRefFromUrl(rawUrl);
  if (!ref) {
    return {
      action: "fail",
      reason:
        "Unrecognised Supabase host; use a *.supabase.co URL or localhost.",
    };
  }

  if (d2GoldenProdProjectRefs(env).includes(ref)) {
    const builtIn = DEFAULT_SUPABASE_PROD_PROJECT_REFS.some(
      (item) => item.toLowerCase() === ref,
    );
    const where = builtIn
      ? "is a built-in production project ref"
      : "is listed in SUPABASE_PROD_PROJECT_REFS";
    return {
      action: "fail",
      reason: `Supabase project ref "${ref}" ${where}. Refusing to read production. ${D2_MWC_ANON_DENIED_MESSAGE}`,
    };
  }

  return { action: "run" };
}

/**
 * Skip unless opted in. Otherwise the same prod gate as `decideD2MwcDatabase`.
 */
export function decideD2GoldenRun(env: D2GoldenEnv): D2GoldenDecision {
  if (!flagOn(env, D2_GOLDEN_RUN_ENV)) {
    return {
      action: "skip",
      reason:
        "RUN_D2_GOLDEN is not 1; D2 filter golden parity is opt-in (pnpm test:d2).",
    };
  }

  const decision = decideD2MwcDatabase(env);
  if (decision.action === "fail" && !supabaseUrl(env)) {
    return {
      action: "fail",
      reason:
        "RUN_D2_GOLDEN=1 but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is missing.",
    };
  }
  return decision;
}

function errorText(error: unknown): { code: string; message: string } {
  if (typeof error !== "object" || error === null) {
    return { code: "", message: error instanceof Error ? error.message : "" };
  }
  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === "string" ? record.code : "",
    message:
      typeof record.message === "string"
        ? record.message
        : error instanceof Error
          ? error.message
          : "",
  };
}

export function isD2MwcPermissionDenied(error: unknown): boolean {
  const { code, message } = errorText(error);
  return code === "42501" || /permission denied/i.test(message) || /\b42501\b/.test(message);
}

/** Safe text for logs and test failures. Permission errors never include row contents. */
export function d2MwcFailureText(error: unknown): string {
  if (isD2MwcPermissionDenied(error)) return D2_MWC_ANON_DENIED_MESSAGE;
  const { code } = errorText(error);
  if (code) return `mwc_contractors read failed (${code})`;
  if (error instanceof Error && error.message) return error.message;
  return "mwc_contractors read failed";
}

/** Anon key only. A service-role value in env is ignored. */
export function selectD2GoldenSupabaseKey(env: D2GoldenEnv): D2GoldenKeyChoice {
  for (const name of D2_GOLDEN_ANON_KEY_ENV_NAMES) {
    const key = env[name]?.trim();
    if (key) return { ok: true, key, source: "anon" };
  }
  return {
    ok: false,
    reason:
      "D2 golden needs NEXT_PUBLIC_SUPABASE_ANON_KEY (service role is never used).",
  };
}

function toMwcRow(row: D2MwcNameRow): MwcRow {
  return {
    company_name: row.company_name ?? "",
    registration_no: row.registration_no ?? "",
    phone: null,
    expiry_date: null,
    primary_signatory_name: null,
    source_updated_at: null,
  };
}

/**
 * Page `company_name, registration_no` ordered by id. Stops on an empty page.
 * Does not log row contents.
 */
export async function loadD2GoldenMwcRows(
  client: Pick<SupabaseClient, "from">,
): Promise<MwcRow[]> {
  let from = 0;
  const rows: MwcRow[] = [];
  let expectedCount: number | null = null;
  const columns = d2GoldenMwcSelectList();

  while (true) {
    const page = (await client
      .from("mwc_contractors")
      .select(columns, { count: "exact" })
      .order("id", { ascending: true })
      .range(from, from + 999)) as D2MwcPage;

    if (page.error) {
      throw new Error(d2MwcFailureText(page.error));
    }
    if (typeof page.count === "number" && expectedCount === null) {
      expectedCount = page.count;
    }
    const batch = page.data ?? [];
    if (batch.length === 0) break;
    for (const row of batch) rows.push(toMwcRow(row));
    from += batch.length;
  }

  if (expectedCount === null || rows.length !== expectedCount) {
    throw new Error(
      `mwc_contractors row count mismatch (got ${rows.length}, expected ${expectedCount ?? "null"})`,
    );
  }
  if (expectedCount < D2_GOLDEN_MIN_MWC_ROWS) {
    throw new Error(
      `mwc_contractors returned too few rows (${expectedCount}); RLS or wrong project?`,
    );
  }
  return rows;
}
