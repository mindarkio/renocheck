import {
  QUOTE_PDF_MAX_BYTES,
  QUOTE_PDF_MAX_PAGES,
} from "@/lib/quote-analysis/config";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export type PdfRejectReason =
  | "type"
  | "magic"
  | "size"
  | "encrypted"
  | "pages"
  | "unreadable";

export type PdfCheck =
  | { ok: true; pageCount: number }
  | { ok: false; reason: PdfRejectReason };

export function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

/**
 * Best-effort page count. Counts `/Type /Page` and ignores `/Type /Pages`.
 * No PDF parser dependency. Encrypted files are rejected.
 */
export function inspectPdf(bytes: Uint8Array, mediaType: string): PdfCheck {
  if (mediaType.toLowerCase() !== "application/pdf") {
    return { ok: false, reason: "type" };
  }
  if (!hasPdfMagic(bytes)) return { ok: false, reason: "magic" };
  if (bytes.byteLength > QUOTE_PDF_MAX_BYTES) return { ok: false, reason: "size" };

  const text = new TextDecoder("latin1").decode(bytes);
  if (text.includes("/Encrypt")) return { ok: false, reason: "encrypted" };

  const pages = text.match(/\/Type\s*\/Page(?!s)/g);
  const pageCount = pages?.length ?? 0;
  if (pageCount < 1) return { ok: false, reason: "unreadable" };
  if (pageCount > QUOTE_PDF_MAX_PAGES) return { ok: false, reason: "pages" };
  return { ok: true, pageCount };
}
