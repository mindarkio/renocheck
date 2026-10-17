import { parseDclListDate } from "./parse-html-utils";

/** Ensure list page date matches requested DDMMYYYY (L3). */
export function assertPageListDate(html: string, requestedDdMmYyyy: string): void {
  const expectedIso = parseDclListDate(requestedDdMmYyyy);
  const patterns = [
    new RegExp(`date=${requestedDdMmYyyy}`, "i"),
    new RegExp(expectedIso.replace(/-/g, "[/\\-]")),
    new RegExp(
      `${requestedDdMmYyyy.slice(0, 2)}[/.]${requestedDdMmYyyy.slice(2, 4)}[/.]${requestedDdMmYyyy.slice(4)}`,
    ),
  ];
  if (!patterns.some((p) => p.test(html))) {
    throw new Error(
      `DCL page date mismatch: expected ${requestedDdMmYyyy} (${expectedIso})`,
    );
  }
}
