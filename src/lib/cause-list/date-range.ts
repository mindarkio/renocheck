import { ddMmYyyyToSortable } from "./parse-html-utils";

export function isDdMmYyyyInRange(
  fileDate: string,
  from: string,
  to: string,
): boolean {
  const d = ddMmYyyyToSortable(fileDate);
  return d >= ddMmYyyyToSortable(from) && d <= ddMmYyyyToSortable(to);
}
