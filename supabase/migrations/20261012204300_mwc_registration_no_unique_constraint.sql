drop index if exists public.mwc_contractors_registration_no_uidx;

alter table public.mwc_contractors
  add constraint mwc_contractors_registration_no_key unique (registration_no);
