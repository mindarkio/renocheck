import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  USAGE_DETAIL_CODES,
  USAGE_EVENT_TYPES,
  usageDetailFromError,
  usageEventBodySchema,
  isMissingAnonIdColumn,
  isMissingUsageDetailColumn,
  isMissingUsageEventsTable,
} from "./usage-event";

const ANON = "12345678-1234-4234-8234-123456789abc";
const FP = "ab".repeat(16);

describe("usage event validation", () => {
  it("accepts a quote event with no fingerprint", () => {
    const parsed = usageEventBodySchema.parse({
      anonId: ANON.toUpperCase(),
      eventType: "quote_page",
    });
    expect(parsed).toEqual({ anonId: ANON, eventType: "quote_page" });
  });

  it("accepts a report event with a fingerprint", () => {
    const parsed = usageEventBodySchema.parse({
      anonId: ANON,
      eventType: "report_share",
      fingerprint: FP,
    });
    expect(parsed.fingerprint).toBe(FP);
  });

  it("rejects a non-uuid, an unknown event, a bad fingerprint, and extra fields", () => {
    expect(
      usageEventBodySchema.safeParse({ anonId: "nope", eventType: "quote_page" }).success,
    ).toBe(false);
    expect(
      usageEventBodySchema.safeParse({ anonId: ANON, eventType: "search" }).success,
    ).toBe(false);
    expect(
      usageEventBodySchema.safeParse({
        anonId: ANON,
        eventType: "report_official_link",
        fingerprint: "short",
      }).success,
    ).toBe(false);
    expect(
      usageEventBodySchema.safeParse({
        anonId: ANON,
        eventType: "quote_copy_reply",
        companyName: "示例裝修有限公司",
        phone: "91234567",
      }).success,
    ).toBe(false);
    expect(
      usageEventBodySchema.safeParse({
        anonId: ANON,
        eventType: "quote_analyze_fail",
        detail: "示例裝修有限公司",
      }).success,
    ).toBe(false);
  });

  it("accepts a fail step with a reason code and maps API errors", () => {
    const parsed = usageEventBodySchema.parse({
      anonId: ANON,
      eventType: "quote_analyze_fail",
      detail: "budget",
    });
    expect(parsed.detail).toBe("budget");
    expect(usageDetailFromError("quote_paused")).toBe("budget");
    expect(usageDetailFromError("quote_unavailable")).toBe("unavailable");
    expect(usageDetailFromError("not_a_real_code")).toBe("unknown");
    expect(usageDetailFromError(undefined)).toBe("unknown");
  });

  it("lists every event type in the funnel migration", () => {
    const sql = readFileSync(
      "supabase/migrations/20261106160000_quote_funnel_usage_events.sql",
      "utf8",
    );
    for (const eventType of USAGE_EVENT_TYPES) expect(sql).toContain(`'${eventType}'`);
    for (const detail of USAGE_DETAIL_CODES) {
      expect(detail).toMatch(/^[a-z][a-z0-9_]{0,31}$/);
    }
  });

  it("recognises a missing anon id column and a missing usage table", () => {
    expect(
      isMissingAnonIdColumn({
        code: "PGRST204",
        message: "Could not find the 'anon_id' column of 'search_events' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingAnonIdColumn({
        code: "42703",
        message: "column search_events.anon_id does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingAnonIdColumn({ code: "42703", message: "column other does not exist" }),
    ).toBe(false);
    expect(
      isMissingUsageEventsTable({
        code: "PGRST205",
        message: "Could not find the table 'public.usage_events' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingUsageEventsTable({
        code: "42P01",
        message: 'relation "public.usage_events" does not exist',
      }),
    ).toBe(true);
    expect(isMissingUsageEventsTable(null)).toBe(false);
    expect(
      isMissingUsageDetailColumn({
        code: "PGRST204",
        message: "Could not find the 'detail' column of 'usage_events' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingUsageDetailColumn({
        code: "PGRST205",
        message: "Could not find the table 'public.usage_events' in the schema cache",
      }),
    ).toBe(false);
  });
});
