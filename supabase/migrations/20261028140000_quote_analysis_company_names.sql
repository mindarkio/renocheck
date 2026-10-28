-- Additive company-name columns on quote_analyses.
-- Safe to re-run. Owner applies this manually before deploy.
-- Does not use least or greatest. No signature change to existing functions.
-- Rows are still removed by purge_quote_analysis_retention and delete-account,
-- so these columns leave with the row (180 days or account deletion).

alter table public.quote_analyses
  add column if not exists extracted_company_name text;

alter table public.quote_analyses
  add column if not exists confirmed_company_name text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'quote_analyses_extracted_company_name_len'
       and conrelid = 'public.quote_analyses'::regclass
  ) then
    alter table public.quote_analyses
      add constraint quote_analyses_extracted_company_name_len
      check (
        extracted_company_name is null
        or char_length(extracted_company_name) <= 100
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'quote_analyses_confirmed_company_name_len'
       and conrelid = 'public.quote_analyses'::regclass
  ) then
    alter table public.quote_analyses
      add constraint quote_analyses_confirmed_company_name_len
      check (
        confirmed_company_name is null
        or char_length(confirmed_company_name) <= 100
      );
  end if;
end
$$;
