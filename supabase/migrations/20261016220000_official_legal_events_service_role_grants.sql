-- DEC-0012: explicit grants — service_role only (pipeline + import).
-- NOT applied on remote until owner approves. Pair with down file if rolled back.

revoke all on table public.official_legal_events from anon, authenticated;

grant select, insert, update, delete on table public.official_legal_events to service_role;
