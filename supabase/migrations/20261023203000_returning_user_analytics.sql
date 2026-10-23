-- Returning-user analytics. File only — do not apply from this change.
-- Aaron applies it (SQL editor or `pnpm db:push` after review).
-- Rollback: supabase/rollbacks/20261023203000_returning_user_analytics.down.sql
--
-- anon_id is a random UUID generated in the browser (crypto.randomUUID) and
-- kept in localStorage. It is not a cookie. Do not add IP, user agent, name,
-- phone, or email columns beside it.
--
-- Retention is 90 days. purge_returning_user_anon_ids() sets anon_id to null
-- on rows older than that. The rows stay, so search totals and usage counts
-- remain. Vercel Cron calls it daily at 18:20 UTC (02:20 Hong Kong) through
-- GET /api/cron/purge-anon-ids (vercel.json). No pg_cron is needed.

alter table public.search_events
  add column if not exists anon_id uuid;

comment on column public.search_events.anon_id is
  'Random browser UUID for repeat-use counts. Not linked to name, contact details, IP, or user agent. Nulled after 90 days; the search row stays.';

create index if not exists search_events_anon_id_created_at_idx
  on public.search_events (anon_id, created_at desc)
  where anon_id is not null;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so a 90-day purge can clear the identifier and keep the event row.
  anon_id uuid,
  event_type text not null check (event_type in (
    'quote_page',
    'quote_all_ticked',
    'quote_copy_reply',
    'report_official_link',
    'report_share'
  )),
  -- Same non-personal fingerprint already stored on search_events. Null for /quote.
  fingerprint text check (fingerprint is null or fingerprint ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now()
);

-- An environment that ran an earlier draft of this file has NOT NULL here.
-- The purge would then fail, so drop it explicitly. Safe to re-run.
alter table public.usage_events alter column anon_id drop not null;

comment on table public.usage_events is
  'Anonymous usage counts. anon_id is a random browser UUID. Not linked to name, contact details, IP, or user agent. anon_id is nulled after 90 days; the event row stays.';

create index if not exists usage_events_created_at_idx
  on public.usage_events (created_at desc);

create index if not exists usage_events_anon_id_created_at_idx
  on public.usage_events (anon_id, created_at desc);

alter table public.usage_events enable row level security;

revoke all on table public.usage_events from anon, authenticated;
grant select, insert, update, delete on table public.usage_events to service_role;

-- Clears anon_id older than 90 days. Does not delete search_events or usage_events.
create or replace function public.purge_returning_user_anon_ids()
returns table (search_events_cleared bigint, usage_events_cleared bigint)
language plpgsql
set search_path = ''
as $$
declare
  search_cleared bigint;
  usage_cleared bigint;
begin
  update public.search_events
     set anon_id = null
   where anon_id is not null
     and created_at < now() - interval '90 days';
  get diagnostics search_cleared = row_count;

  update public.usage_events
     set anon_id = null
   where anon_id is not null
     and created_at < now() - interval '90 days';
  get diagnostics usage_cleared = row_count;

  return query select search_cleared, usage_cleared;
end;
$$;

comment on function public.purge_returning_user_anon_ids() is
  'Null anon_id on search_events and usage_events older than 90 days. Rows stay. Schedule daily: select * from public.purge_returning_user_anon_ids();';

revoke all on function public.purge_returning_user_anon_ids() from public, anon, authenticated;
grant execute on function public.purge_returning_user_anon_ids() to service_role;
