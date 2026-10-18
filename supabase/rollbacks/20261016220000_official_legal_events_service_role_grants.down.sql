-- Emergency only. Never revoke service_role. 20261018140000 is unrelated (it locks mwc_contractors/search_cache/search_events).

-- Rollback: 20261016220000_official_legal_events_service_role_grants.sql
-- Restores anon/authenticated SELECT, INSERT, UPDATE, DELETE on official_legal_events only; does not restore TRUNCATE, REFERENCES, TRIGGER, or MAINTAIN. Does not revoke service_role.

grant select, insert, update, delete on table public.official_legal_events to anon, authenticated;
