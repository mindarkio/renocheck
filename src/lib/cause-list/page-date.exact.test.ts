import { describe, expect, it } from "vitest";
import { assertPageListDate } from "./page-date";

describe("assertPageListDate", () => {
  it("accepts the judiciary long English date and rejects a neighbouring day", () => {
    expect(() =>
      assertPageListDate("Date: Wednesday, 6 November 2024", "06112024"),
    ).not.toThrow();
    expect(() => assertPageListDate("16 November 2024", "06112024")).toThrow(
      /date mismatch/,
    );
    expect(() => assertPageListDate("06/11/2024", "06112024")).not.toThrow();
  });
});
