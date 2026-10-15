-- MWC registry display fields (DATA.GOV snapshot; MVP+ official block)

alter table public.mwc_contractors
  add column if not exists expiry_date date,
  add column if not exists primary_signatory_name text;

comment on column public.mwc_contractors.expiry_date is
  'Register expiry (EXPIRY_DATE) from BD open data CSV';
comment on column public.mwc_contractors.primary_signatory_name is
  'Primary authorized signatory from deduped CSV row (AS_NAME_CHINESE or ENGLISH)';
