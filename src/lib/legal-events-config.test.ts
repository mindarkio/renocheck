import { afterEach, describe, expect, it } from "vitest";
import { isLegalEventsEnabled } from "./legal-events-config";

describe("isLegalEventsEnabled", () => {
  const prev = process.env.LEGAL_EVENTS_ENABLED;
  const prevNode = process.env.NODE_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.LEGAL_EVENTS_ENABLED;
    else process.env.LEGAL_EVENTS_ENABLED = prev;
    process.env.NODE_ENV = prevNode;
  });

  it("is on in development when unset", () => {
    delete process.env.LEGAL_EVENTS_ENABLED;
    process.env.NODE_ENV = "development";
    expect(isLegalEventsEnabled()).toBe(true);
  });

  it("is off in production when unset", () => {
    delete process.env.LEGAL_EVENTS_ENABLED;
    process.env.NODE_ENV = "production";
    expect(isLegalEventsEnabled()).toBe(false);
  });

  it("respects explicit off in development", () => {
    process.env.LEGAL_EVENTS_ENABLED = "0";
    process.env.NODE_ENV = "development";
    expect(isLegalEventsEnabled()).toBe(false);
  });
});
