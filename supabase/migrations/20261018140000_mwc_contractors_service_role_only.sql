-- mwc_contractors: service_role only (pipeline, import, scripts).
-- Drops mwc_contractors_select_anon (anon, authenticated USING true), which
-- exposed the whole table including phone and primary_signatory_name.
-- RLS stays enabled (this migration does not disable it).
-- Not applied. Apply requires Aaron's approval.
-- Pair with supabase/rollbacks/20261018140000_mwc_contractors_service_role_only.down.sql

revoke all on table public.mwc_contractors from anon, authenticated;

drop policy if exists mwc_contractors_select_anon on public.mwc_contractors;

grant select, insert, update, delete on table public.mwc_contractors to service_role;
