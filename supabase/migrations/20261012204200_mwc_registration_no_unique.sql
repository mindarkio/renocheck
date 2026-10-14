-- One row per BD registration number after import dedupe
create unique index mwc_contractors_registration_no_uidx
  on public.mwc_contractors (registration_no)
  where registration_no is not null;
