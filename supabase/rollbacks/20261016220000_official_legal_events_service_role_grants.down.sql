-- Rollback: 20261016220000_official_legal_events_service_role_grants.sql
-- Does NOT re-grant anon/authenticated (service_role-only policy).

revoke all on table public.official_legal_events from service_role;
