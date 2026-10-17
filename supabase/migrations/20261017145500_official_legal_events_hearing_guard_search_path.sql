-- Harden hearing_points_source downgrade trigger (search_path); Aaron approved 2026-10-17.

create or replace function public.block_official_legal_events_hearing_source_downgrade()
returns trigger
language plpgsql
set search_path = ''
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

comment on function public.block_official_legal_events_hearing_source_downgrade() is
  'Prevent hearing_points_source regression from ai_verified (DEC-0012). search_path hardened.';
