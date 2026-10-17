-- Restore pre-search_path function body (same logic, default search_path).

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
