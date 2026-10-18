/**
 * Opt-in gate for the D2 filter golden parity test.
 * Pure: callers pass an env snapshot; this module does not read or write process.env.
 */

/** Env names that bypass RLS. Vitest setup removes these from process.env. */
export const SERVICE_ROLE_ENV_NAMES = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

export type ServiceRoleEnvName = (typeof SERVICE_ROLE_ENV_NAMES)[number];

/** Read-only key preferred over service role for the D2 golden read. */
export const D2_GOLDEN_ANON_KEY_ENV_NAMES = ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/** Columns the golden read may select. No personal-name or phone columns. */
export const D2_GOLDEN_MWC_COLUMNS = ["company_name", "registration_no"] as const;

export const D2_GOLDEN_RUN_ENV = "RUN_D2_GOLDEN";
export const D2_GOLDEN_PROD_REFS_ENV = "SUPABASE_PROD_PROJECT_REFS";
export const D2_GOLDEN_ALLOW_PROD_READONLY_ENV = "D2_GOLDEN_ALLOW_PROD_READONLY";
export const D2_GOLDEN_ALLOW_SERVICE_ROLE_ENV = "D2_GOLDEN_ALLOW_SERVICE_ROLE";

export type D2GoldenEnv = Record<string, string | undefined>;

export type D2GoldenDecision =
  | { action: "run" }
  | { action: "skip"; reason: string };

export type D2GoldenKeyChoice =
  | { ok: true; key: string; source: "anon" | "service_role" }
  | { ok: false; reason: string };

const SUPABASE_PROJECT_HOST = /^(?:db\.)?([a-z0-9]+)\.supabase\.co$/i;

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
 * `run` only when RUN_D2_GOLDEN=1 and the URL project ref is not a configured
 * production ref (unless D2_GOLDEN_ALLOW_PROD_READONLY=1).
 */
export function decideD2GoldenRun(env: D2GoldenEnv): D2GoldenDecision {
  if (!flagOn(env, D2_GOLDEN_RUN_ENV)) {
    return {
      action: "skip",
      reason:
        "RUN_D2_GOLDEN is not 1; D2 filter golden parity is opt-in (pnpm test:d2).",
    };
  }

  const ref = supabaseProjectRefFromUrl(supabaseUrl(env));
  const prodRefs = parseSupabaseProdProjectRefs(env[D2_GOLDEN_PROD_REFS_ENV]);
  if (
    ref &&
    prodRefs.includes(ref) &&
    !flagOn(env, D2_GOLDEN_ALLOW_PROD_READONLY_ENV)
  ) {
    return {
      action: "skip",
      reason: `Supabase project ref "${ref}" is listed in SUPABASE_PROD_PROJECT_REFS. Refusing to read production. Set D2_GOLDEN_ALLOW_PROD_READONLY=1 to allow a read-only run.`,
    };
  }

  return { action: "run" };
}

/**
 * Prefer the anon key. Service-role material is returned only when
 * D2_GOLDEN_ALLOW_SERVICE_ROLE=1 and no anon key is set.
 */
export function selectD2GoldenSupabaseKey(env: D2GoldenEnv): D2GoldenKeyChoice {
  for (const name of D2_GOLDEN_ANON_KEY_ENV_NAMES) {
    const key = env[name]?.trim();
    if (key) return { ok: true, key, source: "anon" };
  }

  if (!flagOn(env, D2_GOLDEN_ALLOW_SERVICE_ROLE_ENV)) {
    return {
      ok: false,
      reason:
        "D2 golden prefers NEXT_PUBLIC_SUPABASE_ANON_KEY. SUPABASE_SERVICE_ROLE_KEY is not used unless D2_GOLDEN_ALLOW_SERVICE_ROLE=1.",
    };
  }

  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const key = env[name]?.trim();
    if (key) return { ok: true, key, source: "service_role" };
  }

  return {
    ok: false,
    reason:
      "D2_GOLDEN_ALLOW_SERVICE_ROLE=1 but SUPABASE_SERVICE_ROLE_KEY is not available to the opt-in path.",
  };
}

/**
 * Copy env without service-role names. The retained key is returned only when
 * `allowServiceRole` is true; otherwise it is dropped.
 */
export function partitionServiceRoleEnv(
  env: D2GoldenEnv,
  allowServiceRole: boolean,
): {
  stripped: D2GoldenEnv;
  serviceRole: Partial<Record<ServiceRoleEnvName, string>>;
} {
  const stripped: D2GoldenEnv = { ...env };
  const serviceRole: Partial<Record<ServiceRoleEnvName, string>> = {};
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const value = env[name]?.trim();
    if (allowServiceRole && value) serviceRole[name] = value;
    delete stripped[name];
  }
  return { stripped, serviceRole };
}

export function serviceRoleExplicitlyAllowed(env: D2GoldenEnv): boolean {
  return (
    flagOn(env, D2_GOLDEN_RUN_ENV) && flagOn(env, D2_GOLDEN_ALLOW_SERVICE_ROLE_ENV)
  );
}
