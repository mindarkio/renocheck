export function crStringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
