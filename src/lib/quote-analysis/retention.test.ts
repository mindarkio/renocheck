import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION = "supabase/migrations/20261023220000_quote_analysis.sql";
const ROLLBACK = "supabase/rollbacks/20261023220000_quote_analysis.down.sql";

describe("quote analysis retention purge", () => {
  const migration = readFileSync(MIGRATION, "utf8");
  const fn = migration.slice(
    migration.indexOf("create or replace function public.purge_quote_analysis_retention()"),
  );

  it("deletes analyses and claims after 180 days and spend rows after 30 days", () => {
    expect(fn).toContain("delete from public.quote_analysis_claims");
    expect(fn).toContain("delete from public.quote_analyses");
    expect(fn).toContain("delete from public.quote_spend_daily");
    expect(fn.match(/interval '180 days'/g)).toHaveLength(3);
    expect(fn).toContain("::date - 30");
    expect(fn).toContain("delete from public.auth_otp_rate_limits\n   where reset_at <= pg_catalog.now();");
    expect(fn).toContain("security invoker");
    expect(fn).toContain("set search_path = ''");
    expect(fn.toLowerCase()).not.toContain("security definer");
    expect(fn).toContain(
      "revoke all on function public.purge_quote_analysis_retention() from public, anon, authenticated;",
    );
    expect(fn).toContain(
      "grant execute on function public.purge_quote_analysis_retention() to service_role;",
    );
    expect(fn).not.toContain("to anon");
    expect(fn).not.toContain("to authenticated");
  });

  it("runs daily at a minute other than the existing 18:15 and 18:20 jobs", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const job = vercel.crons.find((cron) => cron.path === "/api/cron/purge-quote-analysis");
    expect(job?.schedule).toBe("25 18 * * *");
    const minutes = vercel.crons.map((cron) => cron.schedule.split(" ")[0]);
    expect(new Set(minutes).size).toBe(minutes.length);
  });

  it("drops the purge function before the tables", () => {
    const rollback = readFileSync(ROLLBACK, "utf8");
    expect(rollback).toContain("drop function if exists public.purge_quote_analysis_retention()");
    expect(rollback.indexOf("purge_quote_analysis_retention")).toBeLessThan(
      rollback.indexOf("drop table"),
    );
    expect(rollback).toContain(
      "drop function if exists public.begin_quote_analysis(uuid, bigint, integer, bigint, bigint, integer)",
    );
  });
});
