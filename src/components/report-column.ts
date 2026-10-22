/** Shared site + report shell widths (PRU-1). */

/** Horizontal gutter outside the capped inner container. */
export const siteLayoutGutterClass = "px-4 lg:px-10";

/**
 * Inner container width (grid / header content). At 1280 viewport: 1120px;
 * at 1440+: 1200px. Below lg: 640px max reading measure.
 *
 * `calc(100%-5rem)` is relative to the already-padded gutter box (`lg:px-10`),
 * so the effective side margin is 80px at 1024–1279 and runs continuously
 * into the 1120px cap at 1280.
 */
export const siteLayoutContainerClass =
  "mx-auto w-full max-w-[640px] min-[1024px]:max-w-[calc(100%-5rem)] min-[1280px]:max-w-[1120px] min-[1440px]:max-w-[1200px]";

/** @deprecated Use full main column width inside report grid. */
export const reportReadingColumnClass = "w-full min-w-0";

export const reportPageColumnClass = siteLayoutContainerClass;

/** Judgments block stays inside the main column (no lg breakout). */
export const legalEventsPanelClass = "w-full min-w-0";

export const reportGridClass =
  "lg:grid lg:grid-cols-12 lg:gap-x-6 lg:items-start";

export const reportMainColumnClass =
  "min-w-0 lg:col-span-8 [&_p]:max-w-[640px]";

export const reportSidebarColumnClass =
  "hidden lg:col-span-4 lg:block lg:self-start";

export const reportSidebarStickyClass =
  "sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto overscroll-contain";
