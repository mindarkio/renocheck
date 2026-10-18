-- mwc_contractors, search_cache, search_events: service_role only.
-- Drops mwc_contractors_select_anon. RLS stays enabled.
-- Applied to prod 2026-10-18.
-- Pair with supabase/rollbacks/20261018140000_mwc_contractors_service_role_only.down.sql

revoke all on table public.mwc_contractors from anon, authenticated;
drop policy if exists mwc_contractors_select_anon on public.mwc_contractors;
grant select, insert, update, delete on table public.mwc_contractors to service_role;
-- M1：RLS 管唔到 TRUNCATE
revoke all on table public.search_cache, public.search_events from anon, authenticated;
grant select, insert, update, delete on table public.search_cache, public.search_events to service_role;
