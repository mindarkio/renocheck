import { randomInt, randomUUID } from "node:crypto";

/** Runtime-only numeric PIN for tests (4–32 digits). Never commit a fixed PIN. */
export function randomTestPin(length = 12): string {
  const n = Math.min(32, Math.max(4, length));
  let digits = String(randomInt(1, 10));
  for (let i = 1; i < n; i++) digits += String(randomInt(0, 10));
  return digits;
}

/** Fake phone literal: leading 0 + 7 digits (not a valid HK user number). */
export function randomFakePhoneDigits(): string {
  return `0${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
}

export function randomTestSecret(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}
