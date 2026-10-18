-- LOCAL / DEV ONLY. Run with:
--   PGOPTIONS='-c renocheck.d2_local_grant=yes' psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/sql/d2-local-anon-read.sql
do $$
begin
  if coalesce(current_setting('renocheck.d2_local_grant', true), '') <> 'yes' then
    raise exception 'refusing: renocheck.d2_local_grant is not set for this session (local/dev only)';
  end if;
end $$;
grant select (id, company_name, registration_no) on table public.mwc_contractors to anon;
drop policy if exists mwc_contractors_select_anon_d2_local on public.mwc_contractors;
create policy mwc_contractors_select_anon_d2_local
  on public.mwc_contractors for select to anon using (true);
