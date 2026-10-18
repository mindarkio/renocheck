/** CR open-data `Brn` field: `C` + 7 digits (e.g. `C1566911`), not IRD 8-digit tax BR alone. */
export function isCrOpenDataBrnEqualValue(value: string): boolean {
  return /^C\d{7}$/i.test(value.trim());
}
