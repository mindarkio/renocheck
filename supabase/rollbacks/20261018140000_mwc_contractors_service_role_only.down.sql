-- Rollback: 20261018140000_mwc_contractors_service_role_only.sql
-- Does NOT re-grant anon/authenticated or recreate mwc_contractors_select_anon.
-- RLS stays enabled.

revoke all on table public.mwc_contractors from service_role;
