-- Upsert key for judgment import: (source_catalog_id, case_ref).
-- Blocks lowering hearing_points_source after ai_verified.

create unique index if not exists official_legal_events_catalog_case_ref_key
  on public.official_legal_events (source_catalog_id, case_ref);

create or replace function public.block_official_legal_events_hearing_source_downgrade()
returns trigger
language plpgsql
as $$
begin
  if old.hearing_points_source = 'ai_verified'
    and new.hearing_points_source is distinct from old.hearing_points_source
    and new.hearing_points_source is distinct from 'ai_verified' then
    raise exception 'hearing_points_source_downgrade_blocked: ai_verified is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists official_legal_events_hearing_source_downgrade
  on public.official_legal_events;

create trigger official_legal_events_hearing_source_downgrade
  before update on public.official_legal_events
  for each row
  execute function public.block_official_legal_events_hearing_source_downgrade();

comment on function public.block_official_legal_events_hearing_source_downgrade() is
  'Prevent hearing_points_source regression from ai_verified (DEC-0012).';
