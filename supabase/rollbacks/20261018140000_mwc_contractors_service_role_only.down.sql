-- EMERGENCY ONLY: restores the pre-20261018140000 state exactly, which RE-EXPOSES phone and primary_signatory_name to anon.
-- Prefer a forward fix. Never revoke service_role here.
revoke all on table public.mwc_contractors from anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger on table public.mwc_contractors to anon, authenticated;
drop policy if exists mwc_contractors_select_anon on public.mwc_contractors;
create policy mwc_contractors_select_anon on public.mwc_contractors for select to anon, authenticated using (true);
grant select, insert, update, delete, truncate, references, trigger on table public.search_cache, public.search_events to anon, authenticated;
