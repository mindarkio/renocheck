"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { brandPageTitleClass } from "@/lib/ui-surfaces";

/** The saved checklist is the result. Move focus here once it is on the page. */
export function QuoteResultHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={brandPageTitleClass}>
      {children}
    </h1>
  );
}
