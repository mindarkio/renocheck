-- report_feedback: service_role only. RLS on, no policies.
-- File only. Do not apply to prod (lvrasvtilgzwtfsfjbzd) from this change.
-- Pair with supabase/rollbacks/20261020180000_report_feedback.down.sql

create table public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  surface text not null check (surface in ('company_report','quote_analysis')),
  report_ref text not null check (report_ref ~ '^[0-9a-f]{32}$' or report_ref ~ '^[0-9a-f-]{36}$'), -- fingerprint or quote analysis uuid
  report_version text,                      -- REPORT_VERSION or QUOTE_ANALYSIS_VERSION at time of rating
  rating text not null check (rating in ('up','down')),
  comment text check (comment is null or char_length(comment) <= 500),  -- server-redacted; C0/C1 control + bidi chars stripped before insert [Rev3 L3]
  placement text not null check (placement in ('slide_in','inline')),
  device_hash text not null,                -- HMAC(rc_did); never raw cookie
  unique (surface, report_ref, device_hash) -- one vote per report per device; upsert allows changing vote
);
create index report_feedback_created_at_idx on public.report_feedback (created_at desc);
create index report_feedback_ref_idx on public.report_feedback (surface, report_ref);
alter table public.report_feedback enable row level security;
revoke all on table public.report_feedback from anon, authenticated;
grant select, insert, update, delete on table public.report_feedback to service_role;
