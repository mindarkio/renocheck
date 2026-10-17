alter table public.official_legal_events
  drop constraint if exists official_legal_events_hearing_points_source_check;

alter table public.official_legal_events
  drop column if exists hearing_points_source;
