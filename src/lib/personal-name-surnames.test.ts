import { describe, expect, it } from "vitest";
import { isPersonalSurname } from "./personal-name-surnames";

describe("isPersonalSurname", () => {
  it("matches Ho in any capitalisation and common surnames", () => {
    expect(isPersonalSurname("Ho")).toBe(true);
    expect(isPersonalSurname("ho")).toBe(true);
    expect(isPersonalSurname("HO")).toBe(true);
    expect(isPersonalSurname("Chan")).toBe(true);
    expect(isPersonalSurname("Smith")).toBe(true);
  });

  it("does not treat given names or the watched brand words as surnames", () => {
    for (const word of ["alfred", "tim", "urban", "craft", "modern", "living"]) {
      expect(isPersonalSurname(word)).toBe(false);
    }
  });
});
