-- Drops company_name_en and its index. English names stored there are lost.
-- Not applied by supabase db push. Run only after explicit approval.

drop index if exists public.mwc_contractors_company_name_en_idx;

alter table public.mwc_contractors
  drop column if exists company_name_en;
