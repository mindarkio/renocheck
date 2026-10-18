-- Emergency only. Never revoke service_role. Superseded by 20261018140000.

-- Rollback: 20261016220000_official_legal_events_service_role_grants.sql
-- Reverses only the up migration's revoke on anon/authenticated. Does not revoke service_role.

grant select, insert, update, delete on table public.official_legal_events to anon, authenticated;
