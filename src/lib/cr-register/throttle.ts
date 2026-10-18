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
  options?: { maxWaitMs?: number; deadlineMs?: number },
): Promise<ScheduleCrResult<T>> {
  const queueWaitLimitMs =
    options?.deadlineMs !== undefined
      ? options.deadlineMs - Date.now() - 1000
      : (options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);
  const depthAtEnqueue = chainDepth;
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  const estimatedWait = depthAtEnqueue * MIN_INTERVAL_MS + wait;
  if (estimatedWait >= queueWaitLimitMs) {
    return Promise.resolve({ ok: false, reason: "queue_full" });
  }

  chainDepth += 1;
  const next = chain.then(async () => {
    chainDepth -= 1;
    const waitNow = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitNow > 0) {
      await new Promise((r) => setTimeout(r, waitNow));
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
