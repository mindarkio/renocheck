const MIN_INTERVAL_MS = 1000;
const DEFAULT_MAX_WAIT_MS = 2000;

let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();
let chainDepth = 0;

export type ScheduleCrResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "queue_full" };

/** Per serverless instance ≤1 req/s (serialised). */
export function scheduleCrApiRequest<T>(
  run: () => Promise<T>,
  options?: { maxWaitMs?: number },
): Promise<ScheduleCrResult<T>> {
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const depthAtEnqueue = chainDepth;
  chainDepth += 1;
  const next = chain.then(async () => {
    chainDepth -= 1;
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
    const estimatedWait = wait + depthAtEnqueue * MIN_INTERVAL_MS;
    if (estimatedWait > maxWaitMs) {
      return { ok: false as const, reason: "queue_full" };
    }
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestAt = Date.now();
    const value = await run();
    return { ok: true as const, value };
  });
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next as Promise<ScheduleCrResult<T>>;
}

export function resetCrApiThrottleForTests(): void {
  lastRequestAt = 0;
  chain = Promise.resolve();
  chainDepth = 0;
}
