-- Track 1: parallel quotes for hearing_key_points_zh (DEC-0012 verified import).

alter table public.official_legal_events
  add column if not exists hearing_key_point_quotes_zh jsonb not null default '[]'::jsonb;

comment on column public.official_legal_events.hearing_key_point_quotes_zh is
  'sourceQuoteZh per hearing point; same order as hearing_key_points_zh.';
