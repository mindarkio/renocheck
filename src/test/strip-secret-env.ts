/** Drop secret-shaped env names before Vitest files run. Does not log values. */
export const SECRET_ENV_PATTERN =
  /(SERVICE_ROLE|SERVICE_KEY|SECRET|DB_PASSWORD|DATABASE_URL|POSTGRES_URL|SUPABASE_ACCESS_TOKEN)/i;

export function stripSecretEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string[] {
  const removed: string[] = [];
  for (const key of Object.keys(env)) {
    if (!SECRET_ENV_PATTERN.test(key)) continue;
    delete env[key];
    removed.push(key);
  }
  return removed;
}

stripSecretEnv(process.env);
