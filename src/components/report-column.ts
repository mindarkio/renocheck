/** Shared site + report shell widths (PRU-1). */

/** Mobile 640px measure + 16px gutter; lg+ uses 40px gutter until xl cap. */
export const siteLayoutContainerClass =
  "mx-auto w-full max-w-[640px] px-4 lg:max-w-none lg:px-10 min-[1280px]:max-w-[1120px] min-[1440px]:max-w-[1200px]";

/** @deprecated Use full main column width inside report grid. */
export const reportReadingColumnClass = "w-full min-w-0";

export const reportPageColumnClass = siteLayoutContainerClass;

/** Judgments block stays inside the main column (no lg breakout). */
export const legalEventsPanelClass = "w-full min-w-0";

export const reportGridClass =
  "lg:grid lg:grid-cols-12 lg:gap-x-6 lg:items-start";

export const reportMainColumnClass = "min-w-0 lg:col-span-8";

export const reportSidebarColumnClass = "hidden lg:col-span-4 lg:block";

export const reportSidebarStickyClass =
  "sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto overscroll-contain";
