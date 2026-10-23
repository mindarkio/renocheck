-- English name beside company_name (Chinese-first display name).
-- Not applied by this change. Aaron applies it, then re-imports MWC.
-- Rollback: supabase/rollbacks/20261023180000_mwc_company_name_en.down.sql
--
-- Index matches mwc_contractors_company_name_idx (btree). Leading-wildcard
-- ILIKE does not use that btree, same as company_name. pg_trgm is not enabled.

alter table public.mwc_contractors
  add column if not exists company_name_en text;

comment on column public.mwc_contractors.company_name_en is
  'English company or contractor name from the BD register. Null when the source row has no English name. company_name stays the Chinese-first display name.';

create index if not exists mwc_contractors_company_name_en_idx
  on public.mwc_contractors (company_name_en);
