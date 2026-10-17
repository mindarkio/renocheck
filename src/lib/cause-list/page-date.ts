import { parseDclListDate } from "./parse-html-utils";

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Judiciary header: "Date: Wednesday, 6 November 2024" (day may be unpadded). */
function englishLongDatePattern(ddmmyyyy: string): RegExp {
  const day = Number(ddmmyyyy.slice(0, 2));
  const monthIndex = Number(ddmmyyyy.slice(2, 4)) - 1;
  const year = ddmmyyyy.slice(4);
  const month = ENGLISH_MONTHS[monthIndex];
  if (!month || !Number.isInteger(day)) {
    return /(?!)/;
  }
  return new RegExp(`(?<!\\d)0?${day}(?!\\d)\\s+${month}\\s+${year}`, "i");
}

/** Ensure list page date matches requested DDMMYYYY (L3). */
export function assertPageListDate(html: string, requestedDdMmYyyy: string): void {
  const expectedIso = parseDclListDate(requestedDdMmYyyy);
  const patterns = [
    new RegExp(`date=${requestedDdMmYyyy}`, "i"),
    new RegExp(expectedIso.replace(/-/g, "[/\\-]")),
    new RegExp(
      `${requestedDdMmYyyy.slice(0, 2)}[/.]${requestedDdMmYyyy.slice(2, 4)}[/.]${requestedDdMmYyyy.slice(4)}`,
    ),
    englishLongDatePattern(requestedDdMmYyyy),
  ];
  if (!patterns.some((p) => p.test(html))) {
    throw new Error(
      `DCL page date mismatch: expected ${requestedDdMmYyyy} (${expectedIso})`,
    );
  }
}
