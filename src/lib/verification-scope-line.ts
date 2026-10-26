import {
  SCOPE_HEADING_ZH,
  scopeLineWhenSlashZh,
  scopeLineZh,
} from "./search-disambiguation-copy";

/** Ignore spaces and full-width characters. Case is folded so ABC and abc match. */
export function foldVerificationScopeName(value: string): string {
  return value.normalize("NFKC").replace(/[\s\u3000]+/g, "").toLowerCase();
}

export type VerificationScopeLine = {
  heading: typeof SCOPE_HEADING_ZH;
  line: string;
};

/**
 * Shown when a register row was used and the typed text is not that register
 * name. Hidden when there is no register row, or the two strings match.
 */
export function verificationScopeLine(input: {
  typed: string;
  registerName: string;
  mwcMatched: boolean;
}): VerificationScopeLine | null {
  if (!input.mwcMatched) return null;
  const typed = input.typed.trim();
  const registerName = input.registerName.trim();
  if (!typed || !registerName) return null;
  if (foldVerificationScopeName(typed) === foldVerificationScopeName(registerName)) {
    return null;
  }
  const slash = /[/／]/u.test(typed) || /[/／]/u.test(registerName);
  return {
    heading: SCOPE_HEADING_ZH,
    line: slash
      ? scopeLineWhenSlashZh(typed, registerName)
      : scopeLineZh(typed, registerName),
  };
}
