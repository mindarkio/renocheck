import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANON_ID_RETENTION_DAYS, anonIdPastRetention } from "./anon-id-retention";

const MIGRATION = "supabase/migrations/20261023203000_returning_user_analytics.sql";
const ROLLBACK = "supabase/rollbacks/20261023203000_returning_user_analytics.down.sql";

function sql(path: string): string {
  return readFileSync(path, "utf8");
}

describe("anonymous id retention", () => {
  const now = new Date("2026-10-23T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  it("clears an id strictly older than 90 days and keeps the boundary", () => {
    expect(ANON_ID_RETENTION_DAYS).toBe(90);
    const boundary = new Date(now.getTime() - 90 * day);
    expect(anonIdPastRetention(boundary, now)).toBe(false);
    expect(anonIdPastRetention(new Date(boundary.getTime() - 1), now)).toBe(true);
    expect(anonIdPastRetention(new Date(boundary.getTime() + 1), now)).toBe(false);
    expect(anonIdPastRetention("not-a-date", now)).toBe(false);
  });

  it("nulls anon_id on both tables and does not delete the rows", () => {
    const migration = sql(MIGRATION);
    const fn = migration.slice(migration.indexOf("create or replace function public.purge_returning_user_anon_ids()"));
    expect(fn).toContain("update public.search_events");
    expect(fn).toContain("update public.usage_events");
    expect(fn.match(/set anon_id = null/g)).toHaveLength(2);
    expect(fn.match(/interval '90 days'/g)).toHaveLength(2);
    expect(fn.toLowerCase()).not.toContain("delete from");
    expect(fn.match(/and created_at < now\(\) - interval '90 days'/g)).toHaveLength(2);
    expect(fn.match(/where anon_id is not null/g)).toHaveLength(2);
    expect(fn).toContain("set search_path = ''");
    expect(fn.toLowerCase()).not.toContain("security definer");
    expect(fn).toContain(
      "revoke all on function public.purge_returning_user_anon_ids() from public, anon, authenticated;",
    );
    expect(fn).toContain(
      "grant execute on function public.purge_returning_user_anon_ids() to service_role;",
    );
    expect(migration).toContain("anon_id uuid,");
    expect(migration).not.toContain("anon_id uuid not null");
    expect(migration).toContain("alter column anon_id drop not null");
    const vercel = JSON.parse(sql("vercel.json")) as { crons: { path: string }[] };
    expect(vercel.crons.map((cron) => cron.path)).toContain("/api/cron/purge-anon-ids");
    const rollback = sql(ROLLBACK);
    expect(rollback).toContain("drop function if exists public.purge_returning_user_anon_ids()");
    expect(rollback.indexOf("drop function")).toBeLessThan(rollback.indexOf("drop table"));
  });
});
