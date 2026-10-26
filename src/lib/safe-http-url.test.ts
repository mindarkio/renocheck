import { describe, expect, it } from "vitest";
import { nonLinkFallbackClasses, safeHttpUrl } from "./safe-http-url";

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

  it("rejects an empty host without throwing", () => {
    expect(() => safeHttpUrl("https://")).not.toThrow();
    expect(safeHttpUrl("https://")).toBeNull();
    expect(safeHttpUrl("http://:80/")).toBeNull();
  });

  it("rejects backslash forms and zero-width or BOM prefixes", () => {
    expect(safeHttpUrl("https:\\\\evil.example")).toBeNull();
    expect(safeHttpUrl("\uFEFFhttps://example.com")).toBeNull();
    expect(safeHttpUrl("\u200Bjavascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https\uFF1A//example.com")).toBeNull();
  });

  it("rejects control or Unicode space characters inside the URL", () => {
    expect(safeHttpUrl("https://exa\tmple.com/")).toBeNull();
    expect(safeHttpUrl("https://example.com/a\nb")).toBeNull();
    expect(safeHttpUrl("https://example.com/a\u00A0b")).toBeNull();
    expect(safeHttpUrl("https://example.com/a\u3000b")).toBeNull();
    expect(safeHttpUrl("https://example.com/a\u2028b")).toBeNull();
  });

  it("rejects URLs with userinfo", () => {
    expect(safeHttpUrl("https://good.example@evil.example/")).toBeNull();
    expect(safeHttpUrl("https://u:p@evil.example/")).toBeNull();
    expect(safeHttpUrl("https://:p@evil.example/")).toBeNull();
    expect(safeHttpUrl("https://evil.example/a@b")).toBe(
      "https://evil.example/a@b",
    );
  });

  it("keeps IDN hosts and explicit ports as http(s) links", () => {
    expect(safeHttpUrl("https://例子.香港/")).toBe("https://例子.香港/");
    expect(safeHttpUrl("https://example.com:8443/a")).toBe(
      "https://example.com:8443/a",
    );
  });
});

describe("nonLinkFallbackClasses", () => {
  it("drops link colour and underline classes only", () => {
    expect(
      nonLinkFallbackClasses(
        "font-medium text-primary underline-offset-2 hover:underline break-all",
      ),
    ).toBe("font-medium break-all");
    expect(nonLinkFallbackClasses(undefined)).toBe("");
  });
});
