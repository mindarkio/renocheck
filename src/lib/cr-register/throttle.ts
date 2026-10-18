const MIN_INTERVAL_MS = 1000;
let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

/** Process-wide ≤1 request/s to data.cr.gov.hk (serialised). */
export function scheduleCrApiRequest<T>(run: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestAt = Date.now();
    return run();
  });
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** @internal test helper */
export function resetCrApiThrottleForTests(): void {
  lastRequestAt = 0;
  chain = Promise.resolve();
}
