alter table public.official_legal_events
  add column if not exists review_status text not null default 'auto';

alter table public.official_legal_events
  add constraint official_legal_events_review_status_check
  check (review_status in ('auto', 'human_verified'));
