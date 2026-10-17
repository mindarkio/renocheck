import { afterEach, describe, expect, it, vi } from "vitest";
import { isLegalEventsEnabled } from "./legal-events-config";

describe("isLegalEventsEnabled", () => {
  const prev = process.env.LEGAL_EVENTS_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.LEGAL_EVENTS_ENABLED;
    else process.env.LEGAL_EVENTS_ENABLED = prev;
    vi.unstubAllEnvs();
  });

  it("is on in development when unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.LEGAL_EVENTS_ENABLED;
    expect(isLegalEventsEnabled()).toBe(true);
  });

  it("is off in production when unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.LEGAL_EVENTS_ENABLED;
    expect(isLegalEventsEnabled()).toBe(false);
  });

  it("respects explicit off in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.LEGAL_EVENTS_ENABLED = "0";
    expect(isLegalEventsEnabled()).toBe(false);
  });
});
