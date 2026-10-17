drop trigger if exists official_legal_events_hearing_source_downgrade
  on public.official_legal_events;

drop function if exists public.block_official_legal_events_hearing_source_downgrade();

drop index if exists public.official_legal_events_catalog_case_ref_key;
