-- DEC-0012: explicit grants — service_role only (pipeline + import).
-- Applied on remote 2026-10-16 (pipeline uses SUPABASE_SERVICE_ROLE_KEY). Pair with down file if rolled back.

revoke all on table public.official_legal_events from anon, authenticated;

grant select, insert, update, delete on table public.official_legal_events to service_role;
