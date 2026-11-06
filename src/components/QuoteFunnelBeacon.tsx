"use client";

import { useEffect } from "react";
import { sendUsageEvent } from "@/lib/usage-events-client";
import type { UsageEventType } from "@/lib/usage-event";

/** One usage event when this page is shown. Failures stay invisible. */
export function QuoteFunnelBeacon({ eventType }: { eventType: UsageEventType }) {
  useEffect(() => {
    sendUsageEvent(eventType);
  }, [eventType]);
  return null;
}
