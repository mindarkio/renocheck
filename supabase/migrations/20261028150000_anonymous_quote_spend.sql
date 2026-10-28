-- Atomic spend holds for logged-out quote analysis.
-- Same locked HKT day row and the same caps as begin_quote_analysis, so the
-- anonymous path can no longer pass the budget check in parallel or overwrite
-- spent/reserved/calls written by other requests. Safe to re-run.
-- Does not use least or greatest. Owner applies this manually before deploy.

create or replace function public.reserve_anonymous_quote_spend(
  p_reserve bigint,
  p_cap_micro bigint,
  p_free_cap_micro bigint,
  p_call_cap integer
) returns date
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.timezone('Asia/Hong_Kong', pg_catalog.now()))::date;
  v_spent bigint;
  v_reserved bigint;
  v_calls integer;
begin
  if p_reserve is null or p_reserve <= 0
     or p_cap_micro is null or p_free_cap_micro is null or p_call_cap is null then
    return null;
  end if;

  insert into public.quote_spend_daily (day_hkt) values (v_day)
  on conflict (day_hkt) do nothing;

  select spent_micro_usd, reserved_micro_usd, calls
    into v_spent, v_reserved, v_calls
    from public.quote_spend_daily
   where day_hkt = v_day
   for update;

  if v_calls >= p_call_cap
     or v_spent + v_reserved + p_reserve > p_free_cap_micro
     or v_spent + v_reserved + p_reserve > p_cap_micro then
    return null;
  end if;

  update public.quote_spend_daily
     set reserved_micro_usd = reserved_micro_usd + p_reserve,
         calls = calls + 1
   where day_hkt = v_day;

  return v_day;
end;
$$;

-- Moves one hold to spent. A null or negative actual books the full hold.
create or replace function public.settle_anonymous_quote_spend(
  p_day date,
  p_reserve bigint,
  p_actual bigint
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_day is null or p_reserve is null or p_reserve < 0 then
    return;
  end if;
  update public.quote_spend_daily
     set reserved_micro_usd = case
           when reserved_micro_usd > p_reserve then reserved_micro_usd - p_reserve
           else 0
         end,
         spent_micro_usd = spent_micro_usd + case
           when p_actual is null or p_actual < 0 then p_reserve
           else p_actual
         end
   where day_hkt = p_day;
end;
$$;

revoke all on function public.reserve_anonymous_quote_spend(bigint, bigint, bigint, integer)
  from public, anon, authenticated;
revoke all on function public.settle_anonymous_quote_spend(date, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.reserve_anonymous_quote_spend(bigint, bigint, bigint, integer)
  to service_role;
grant execute on function public.settle_anonymous_quote_spend(date, bigint, bigint)
  to service_role;
