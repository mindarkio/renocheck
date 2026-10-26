import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./safe-http-url";

describe("safeHttpUrl", () => {
  it("returns a normal http or https URL unchanged", () => {
    const urls = [
      "https://www.facebook.com/groups/a/posts/d",
      "http://example.com/path?q=1",
      "HTTPS://Example.com/A",
      "https://e-services.judiciary.hk/dcl/index.jsp?lang=tc",
    ];
    for (const url of urls) {
      expect(safeHttpUrl(url)).toBe(url);
    }
  });

  it("rejects javascript, including mixed case", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
  });

  it("rejects whitespace or control characters prefixed onto a URL", () => {
    expect(safeHttpUrl(" javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("\njavascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("\tJAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHttpUrl("\r\njavascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("\u0000javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("\u0000https://example.com")).toBeNull();
    expect(safeHttpUrl(" https://example.com")).toBeNull();
    expect(safeHttpUrl("https://example.com ")).toBeNull();
    expect(safeHttpUrl("java\tscript:alert(1)")).toBeNull();
  });

  it("rejects data, file, vbscript, relative, and protocol-relative URLs", () => {
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeHttpUrl("/relative")).toBeNull();
    expect(safeHttpUrl("relative")).toBeNull();
    expect(safeHttpUrl("./relative")).toBeNull();
    expect(safeHttpUrl("//evil.example/a")).toBeNull();
    expect(safeHttpUrl("https:example.com")).toBeNull();
  });

  it("rejects empty and non-string values", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});
