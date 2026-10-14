import { describe, expect, it } from "vitest";
import { normalizeHongKongPhone } from "./normalize-phone";

describe("normalizeHongKongPhone", () => {
  it("strips spaces from 8-digit HK number", () => {
    expect(normalizeHongKongPhone("9328 2980")).toBe("93282980");
  });

  it("uses first segment when slash-separated", () => {
    expect(normalizeHongKongPhone("6123 0898 / 9799 0973")).toBe("61230898");
  });

  it("handles 852 prefix", () => {
    expect(normalizeHongKongPhone("+852 2511 6292")).toBe("25116292");
  });

  it("returns null for empty", () => {
    expect(normalizeHongKongPhone("")).toBeNull();
  });
});
