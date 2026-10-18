let consecutiveErrors = 0;
let circuitOpenUntil = 0;

const DEFAULT_COOLDOWN_MS = 60_000;
const ERROR_THRESHOLD = 3;

export function isCrCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

export function recordCrApiSuccess(): void {
  consecutiveErrors = 0;
}

export function recordCrApiFailure(
  status: number,
  retryAfterHeader?: string | null,
): void {
  if (status === 429) {
    const sec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
    const ms =
      Number.isFinite(sec) && sec > 0 ? sec * 1000 : DEFAULT_COOLDOWN_MS;
    circuitOpenUntil = Date.now() + ms;
    consecutiveErrors = 0;
    return;
  }
  consecutiveErrors += 1;
  if (consecutiveErrors >= ERROR_THRESHOLD) {
    circuitOpenUntil = Date.now() + DEFAULT_COOLDOWN_MS;
    consecutiveErrors = 0;
  }
}

export function resetCrCircuitBreakerForTests(): void {
  consecutiveErrors = 0;
  circuitOpenUntil = 0;
}
