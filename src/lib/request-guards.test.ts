import { describe, expect, it } from "vitest";
import { safeNextPath, sameOrigin } from "@/lib/request-guards";

function req(origin: string | null) {
  const headers: Record<string, string> = {};
  if (origin) headers.origin = origin;
  return new Request("http://localhost:3000/api/x", { method: "POST", headers });
}

describe("sameOrigin", () => {
  it("needs an Origin header that matches the request host", () => {
    expect(sameOrigin(req("http://localhost:3000"))).toBe(true);
    expect(sameOrigin(req(null))).toBe(false);
    expect(sameOrigin(req("https://other.example"))).toBe(false);
    expect(sameOrigin(req("http://localhost:3001"))).toBe(false);
    expect(sameOrigin(req("null"))).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/quote/upload")).toBe("/quote/upload");
    expect(safeNextPath("/account?x=1#top")).toBe("/account?x=1#top");
  });

  it("falls back for empty, absolute and protocol-relative values", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "account",
      "https://evil.example/",
      "//evil.example",
      "/\\evil.example",
      "/..//evil.example",
      "/./..//evil.example",
      "/a/../..//evil.example",
    ]) {
      expect(safeNextPath(raw)).toBe("/quote/upload");
    }
  });

  it("rejects control characters the URL parser strips", () => {
    for (const ch of ["\t", "\n", "\r", "\u0000", "\u007f", " "]) {
      expect(safeNextPath(`/${ch}/evil.example`)).toBe("/quote/upload");
    }
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/quote/upload");
  });
});
