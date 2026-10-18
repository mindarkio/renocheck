import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrApiThrottleForTests, scheduleCrApiRequest } from "./throttle";

describe("scheduleCrApiRequest (M5a)", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetCrApiThrottleForTests();
  });

  it("third enqueue returns queue_full within 50ms (L-a)", async () => {
    resetCrApiThrottleForTests();
    const run = () => new Promise<string>((r) => setTimeout(() => r("ok"), 100));
    scheduleCrApiRequest(run);
    scheduleCrApiRequest(run);
    const t0 = Date.now();
    const r3 = await scheduleCrApiRequest(run);
    expect(Date.now() - t0).toBeLessThan(50);
    expect(r3).toEqual({ ok: false, reason: "queue_full" });
  });

  it("third concurrent call returns queue_full when wait exceeds maxWaitMs", async () => {
    vi.useFakeTimers();
    resetCrApiThrottleForTests();
    const run = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("ok"), 0);
      });

    const p1 = scheduleCrApiRequest(run);
    const p2 = scheduleCrApiRequest(run);
    const p3 = scheduleCrApiRequest(run);

    await vi.runAllTimersAsync();

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.reason).toBe("queue_full");
  });
});
