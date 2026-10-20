/** Off unless explicitly enabled. Accepts "1" or "true" only. */
export function isFeedbackEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const value = env["FEEDBACK_ENABLED"];
  return value === "1" || value === "true";
}

export function quoteHashSecret(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = env.QUOTE_HASH_SECRET?.trim();
  return value ? value : undefined;
}
