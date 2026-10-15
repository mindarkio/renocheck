"use client";

import { useSyncExternalStore } from "react";

/** Cropped to mark interior bars (same geometry as `public/logo/mark-color-transparent.svg`). */
const VIEW_BOX = "28 48 44 27";
const PIVOT = "50px 61.5px";
const CY = 61.5;
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const DURATION = "0.28s";

type BrandMenuMarkProps = {
  open: boolean;
  className?: string;
  /** Reversed strokes on brand navy (e.g. open menu). */
  onPrimary?: boolean;
};

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
}

/** Logo three bars when closed; symmetric X when open (cross-fade at end of morph). */
export function BrandMenuMark({
  open,
  className,
  onPrimary = false,
}: BrandMenuMarkProps) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <svg viewBox={VIEW_BOX} className={className} fill="none" aria-hidden>
      <MenuBars open={open} instant={reduceMotion} onPrimary={onPrimary} />
    </svg>
  );
}

function MenuBars({
  open,
  instant,
  onPrimary,
}: {
  open: boolean;
  instant: boolean;
  onPrimary: boolean;
}) {
  const navy = onPrimary ? "#ffffff" : "#2f5d8a";
  const coral = onPrimary ? "#ff8f7d" : "#d64532";
  const motion = instant
    ? undefined
    : `transform ${DURATION} ${EASE}, opacity ${DURATION} ${EASE}`;
  const bar = {
    strokeWidth: 6.4,
    strokeLinecap: "round" as const,
  };
  const origin = {
    transformOrigin: PIVOT,
    transformBox: "view-box" as const,
  };
  const xArm = { x1: 36, y1: CY, x2: 64, y2: CY };

  return (
    <>
      <g style={{ opacity: open ? 0 : 1, transition: motion }}>
        <line
          x1="31"
          y1="51"
          x2="69"
          y2="51"
          stroke={navy}
          {...bar}
          style={{
            ...origin,
            transform: open ? "translateY(10.5px) rotate(45deg)" : "none",
            transition: motion,
          }}
        />
        <line
          x1="31"
          y1="61.5"
          x2="69"
          y2="61.5"
          stroke={navy}
          {...bar}
          style={{
            ...origin,
            opacity: open ? 0 : 1,
            transform: open ? "scaleX(0)" : "none",
            transition: motion,
          }}
        />
        <line
          x1="31"
          y1="72"
          x2="55"
          y2="72"
          stroke={coral}
          {...bar}
          style={{
            ...origin,
            transform: open ? "translateY(-10.5px) rotate(-45deg)" : "none",
            transition: motion,
          }}
        />
      </g>
      <g
        style={{
          ...origin,
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.88)",
          transition: motion,
        }}
      >
        <g style={{ transformOrigin: PIVOT, transform: "rotate(45deg)" }}>
          <line {...xArm} stroke={navy} {...bar} />
        </g>
        <g style={{ transformOrigin: PIVOT, transform: "rotate(-45deg)" }}>
          <line {...xArm} stroke={coral} {...bar} />
        </g>
      </g>
    </>
  );
}
