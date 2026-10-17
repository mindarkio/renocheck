-- Rollback: 20261016184025_official_legal_events_review_status.sql

alter table public.official_legal_events
  drop constraint if exists official_legal_events_review_status_check;

alter table public.official_legal_events
  drop column if exists review_status;
