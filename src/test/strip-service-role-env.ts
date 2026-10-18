import {
  SERVICE_ROLE_ENV_NAMES,
  partitionServiceRoleEnv,
  serviceRoleExplicitlyAllowed,
  type ServiceRoleEnvName,
} from "../lib/judgment-d2-golden-gate";

const STASH = Symbol.for("renocheck.d2GoldenServiceRoleStash");

type Stash = Partial<Record<ServiceRoleEnvName, string>>;

type GlobalWithStash = typeof globalThis & {
  [STASH]?: Stash;
};

/**
 * Remove service-role credentials from process.env for every Vitest file.
 * The value is retained off process.env only when RUN_D2_GOLDEN=1 and
 * D2_GOLDEN_ALLOW_SERVICE_ROLE=1 were already set. Re-importing this module
 * does not put the key back onto process.env.
 */
function stripServiceRoleFromProcessEnv(): void {
  const holder = globalThis as GlobalWithStash;
  if (!holder[STASH]) {
    const allow = serviceRoleExplicitlyAllowed(process.env);
    const { serviceRole } = partitionServiceRoleEnv(process.env, allow);
    holder[STASH] = serviceRole;
  }
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    delete process.env[name];
  }
}

stripServiceRoleFromProcessEnv();

export function readStashedServiceRoleEnv(): Stash {
  if (!serviceRoleExplicitlyAllowed(process.env)) return {};
  const holder = globalThis as GlobalWithStash;
  return holder[STASH] ?? {};
}
