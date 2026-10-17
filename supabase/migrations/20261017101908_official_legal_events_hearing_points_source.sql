-- Track 1: provenance for hearing_key_points_zh (DEC-0012 amendment 2026-10-17).

alter table public.official_legal_events
  add column if not exists hearing_points_source text;

alter table public.official_legal_events
  drop constraint if exists official_legal_events_hearing_points_source_check;

alter table public.official_legal_events
  add constraint official_legal_events_hearing_points_source_check
  check (
    hearing_points_source is null
    or hearing_points_source in (
      'llm_draft',
      'ai_verified',
      'manual',
      'placeholder'
    )
  );

comment on column public.official_legal_events.hearing_points_source is
  'Source of hearing_key_points_zh: llm_draft (offline LLM + quote checks), ai_verified (AI vs full text signed off), manual (human seed), placeholder (awaiting summary).';
