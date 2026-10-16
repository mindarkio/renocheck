-- Rollback: 20261016220000_official_legal_events_service_role_grants.sql

revoke all on table public.official_legal_events from service_role;

-- Restore default Supabase table grants if needed (adjust per project policy):
grant select on table public.official_legal_events to anon, authenticated;
