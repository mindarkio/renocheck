import { describe, expect, it } from "vitest";
import { QUOTE_PDF_MAX_BYTES } from "@/lib/quote-analysis/config";
import { inspectPdf } from "@/lib/quote-analysis/pdf";

function pdf(body: string): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4\n${body}\n`);
}

describe("PDF validation", () => {
  it("accepts a one-page PDF and ignores the pages tree", () => {
    const result = inspectPdf(
      pdf("/Type /Pages\n/Type /Page"),
      "application/pdf",
    );
    expect(result).toEqual({ ok: true, pageCount: 1 });
  });

  it("rejects the wrong MIME type even when the magic bytes match", () => {
    expect(inspectPdf(pdf("/Type /Page"), "image/jpeg")).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects files that are not PDFs", () => {
    const bytes = new TextEncoder().encode("not a pdf /Type /Page");
    expect(inspectPdf(bytes, "application/pdf")).toEqual({
      ok: false,
      reason: "magic",
    });
  });

  it("rejects encrypted, oversized, and long PDFs", () => {
    expect(inspectPdf(pdf("/Encrypt /Type /Page"), "application/pdf")).toEqual({
      ok: false,
      reason: "encrypted",
    });
    const oversized = new Uint8Array(QUOTE_PDF_MAX_BYTES + 1);
    oversized.set(new TextEncoder().encode("%PDF-"));
    expect(inspectPdf(oversized, "application/pdf")).toEqual({
      ok: false,
      reason: "size",
    });
    const pages = Array.from({ length: 7 }, () => "/Type /Page").join("\n");
    expect(inspectPdf(pdf(pages), "application/pdf")).toEqual({
      ok: false,
      reason: "pages",
    });
  });
});
