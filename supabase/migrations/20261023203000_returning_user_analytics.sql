-- Returning-user analytics. File only — do not apply from this change.
-- Aaron applies it (SQL editor or `pnpm db:push` after review).
-- Rollback: supabase/rollbacks/20261023203000_returning_user_analytics.down.sql
--
-- anon_id is a random UUID generated in the browser (crypto.randomUUID) and
-- kept in localStorage. It is not a cookie. Do not add IP, user agent, name,
-- phone, or email columns beside it.

alter table public.search_events
  add column if not exists anon_id uuid;

comment on column public.search_events.anon_id is
  'Random browser UUID for repeat-use counts. Not linked to name, contact details, IP, or user agent.';

create index if not exists search_events_anon_id_created_at_idx
  on public.search_events (anon_id, created_at desc)
  where anon_id is not null;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  anon_id uuid not null,
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

comment on table public.usage_events is
  'Anonymous usage counts. anon_id is a random browser UUID. Not linked to name, contact details, IP, or user agent.';

create index if not exists usage_events_created_at_idx
  on public.usage_events (created_at desc);

create index if not exists usage_events_anon_id_created_at_idx
  on public.usage_events (anon_id, created_at desc);

alter table public.usage_events enable row level security;

revoke all on table public.usage_events from anon, authenticated;
grant select, insert, update, delete on table public.usage_events to service_role;
