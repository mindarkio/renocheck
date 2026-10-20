import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  createDeviceId,
  DEVICE_COOKIE_MAX_AGE_SECONDS,
  DEVICE_COOKIE_NAME,
  hashDeviceId,
  readDeviceIdFromCookieHeader,
} from "./device-id";

describe("device id", () => {
  it("creates a 128-bit hex id", () => {
    const id = createDeviceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(createDeviceId()).not.toBe(id);
  });

  it("reads only a valid rc_did cookie", () => {
    const id = "ab".repeat(16);
    expect(readDeviceIdFromCookieHeader(null)).toBeNull();
    expect(readDeviceIdFromCookieHeader("other=1")).toBeNull();
    expect(readDeviceIdFromCookieHeader(`rc_did=short`)).toBeNull();
    expect(
      readDeviceIdFromCookieHeader(`theme=dark; ${DEVICE_COOKIE_NAME}=${id}`),
    ).toBe(id);
  });

  it("hashes with HMAC-SHA256 and does not echo the raw id", () => {
    const id = "cd".repeat(16);
    const secret = "unit-test-secret";
    const hash = hashDeviceId(secret, id);
    expect(hash).toBe(
      createHmac("sha256", secret).update(id).digest("hex"),
    );
    expect(hash).not.toContain(id);
    expect(DEVICE_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
  });
});
