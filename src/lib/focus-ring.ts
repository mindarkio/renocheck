/**
 * Keyboard focus rings shared with the header (PR #43).
 *
 * Ring classes use `outline-hidden`, not `outline-none`: forced-colors mode
 * (Windows High Contrast) drops `box-shadow`, and Tailwind's `outline-hidden`
 * keeps a transparent 2px outline there that the UA repaints in a system colour.
 *
 * Light surfaces use solid brand navy `#2f5d8a`. That colour on the navy
 * footer, report hero, or mobile sheet is about 1:1, so those surfaces use
 * solid white instead. Mouse clicks do not match `:focus-visible` on links
 * and buttons. Prefer the global outline in `globals.css` unless a parent
 * draws the ring (search pill, quote radios) or the control already opts
 * into `focusRingClass` / `focusRingOnPrimaryClass`.
 */

/** Solid `#2f5d8a` on the page background. */
export const focusRingClass =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Solid white on brand navy. Offset matches `bg-primary`. */
export const focusRingOnPrimaryClass =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

/**
 * Label or row that rings when a child control is keyboard-focused. The child
 * keeps `focus-visible:outline-hidden` so forced-colors mode still shows it.
 */
export const childFocusRingClass =
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";

/**
 * Landing search pill. See `.search-field-focus` in `globals.css`.
 * A Tailwind ring is omitted because the pill's own shadow replaces `box-shadow`.
 * `:has(input:focus-visible)` so the icon button (own outline) and pointer
 * clicks on it do not also outline the pill.
 */
export const searchFieldFocusRingClass = "search-field-focus";

/** Sets `--focus-ring` to white for descendants (see `globals.css`). */
export const focusOnPrimaryClass = "focus-on-primary";

export const FOCUS_RING_NAVY = "#2f5d8a";
export const FOCUS_RING_ON_PRIMARY = "#ffffff";

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio. Both arguments are `#rrggbb`. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha composite of `foreground` over opaque `background`. */
export function blendHex(foreground: string, background: string, alpha: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const fg = parse(foreground);
  const bg = parse(background);
  const mixed = fg.map((channel, i) => Math.round(channel * alpha + bg[i] * (1 - alpha)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
