-- Fix for 20261023220000_quote_analysis. File only. Do not apply to prod (lvrasvtilgzwtfsfjbzd)
-- from this change. Aaron applies this himself. No seed data. No email addresses.
--
-- LEAST and GREATEST are SQL syntax (like COALESCE), not pg_catalog functions.
-- Schema-qualified calls to them raise 42883 "function pg_catalog.least(integer, integer)
-- does not exist" at call time (plpgsql bodies are checked lazily), so the functions were
-- created but every call that reaches those lines fails. take_auth_rate_limit reaches it on
-- every valid call, so POST /api/auth/otp and /api/auth/verify always fail closed with 503
-- and auth_otp_rate_limits stays empty.
-- Bare least/greatest are not looked up through search_path, so `set search_path = ''` stays safe.
-- CREATE OR REPLACE with the same signatures keeps the existing grants.

create or replace function public.begin_quote_analysis(
  p_user_id uuid,
  p_reserve bigint,
  p_daily_limit integer,
  p_cap_micro bigint,
  p_free_cap_micro bigint,
  p_call_cap integer
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.timezone('Asia/Hong_Kong', pg_catalog.now()))::date;
  v_used integer;
  v_claim uuid;
  v_spent bigint;
  v_reserved bigint;
  v_calls integer;
begin
  if p_user_id is null
     or p_reserve is null or p_reserve <= 0
     or p_daily_limit is null or p_daily_limit <= 0
     or p_cap_micro is null or p_cap_micro < 0
     or p_free_cap_micro is null or p_free_cap_micro < 0
     or p_call_cap is null or p_call_cap < 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_args');
  end if;

  insert into public.quote_spend_daily (day_hkt) values (v_day)
  on conflict (day_hkt) do nothing;

  select spent_micro_usd, reserved_micro_usd, calls
    into v_spent, v_reserved, v_calls
    from public.quote_spend_daily
   where day_hkt = v_day
   for update;

  with stale as (
    select id, reserved_micro_usd
      from public.quote_analysis_claims
     where status = 'claimed'
       and day_hkt = v_day
       and created_at < pg_catalog.now() - interval '180 seconds'
     for update
  ), released as (
    update public.quote_analysis_claims as c
       set status = 'failed'
      from stale as s
     where c.id = s.id
    returning s.reserved_micro_usd
  )
  update public.quote_spend_daily as d
     set reserved_micro_usd = greatest(0, d.reserved_micro_usd - t.total),
         spent_micro_usd = d.spent_micro_usd + t.total
    from (
      select coalesce(sum(reserved_micro_usd), 0) as total
        from released
    ) as t
   where d.day_hkt = v_day
     and t.total > 0;

  select spent_micro_usd, reserved_micro_usd, calls
    into v_spent, v_reserved, v_calls
    from public.quote_spend_daily
   where day_hkt = v_day;

  select count(*)::integer into v_used
    from public.quote_analyses
   where user_id = p_user_id
     and day_hkt = v_day;

  v_used := v_used + (
    select count(*)::integer
      from public.quote_analysis_claims
     where user_id = p_user_id
       and day_hkt = v_day
       and status = 'claimed'
  );

  if v_used >= p_daily_limit then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'quota');
  end if;

  -- Same locked row. Free analyses stop at the free share; the overall cap and
  -- the call cap still apply. Calls increment only after these checks.
  if v_calls >= p_call_cap
     or v_spent + v_reserved + p_reserve > p_free_cap_micro
     or v_spent + v_reserved + p_reserve > p_cap_micro then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'budget');
  end if;

  update public.quote_spend_daily
     set reserved_micro_usd = reserved_micro_usd + p_reserve,
         calls = calls + 1
   where day_hkt = v_day;

  insert into public.quote_analysis_claims (user_id, day_hkt, status, reserved_micro_usd)
  values (p_user_id, v_day, 'claimed', p_reserve)
  returning id into v_claim;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'ok',
    'claim_id', v_claim
  );
end;
$$;

create or replace function public.finish_quote_analysis(
  p_claim_id uuid,
  p_outcome text,
  p_actual_micro bigint,
  p_page_count smallint,
  p_items jsonb,
  p_input_tokens integer,
  p_output_tokens integer,
  p_model_id text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid;
  v_day date;
  v_reserved bigint;
  v_status text;
  v_analysis uuid;
  v_book bigint;
begin
  if p_outcome is null or p_outcome not in ('succeeded', 'failed', 'released') then
    raise exception 'bad_outcome';
  end if;

  select day_hkt into v_day
    from public.quote_analysis_claims
   where id = p_claim_id;

  if not found then
    return null;
  end if;

  perform 1
    from public.quote_spend_daily
   where day_hkt = v_day
   for update;

  select user_id, day_hkt, reserved_micro_usd, status
    into v_user, v_day, v_reserved, v_status
    from public.quote_analysis_claims
   where id = p_claim_id
   for update;

  if v_status <> 'claimed' then
    return null;
  end if;

  if p_outcome = 'released' then
    update public.quote_spend_daily
       set reserved_micro_usd = greatest(0, reserved_micro_usd - v_reserved)
     where day_hkt = v_day;
    update public.quote_analysis_claims
       set status = 'failed'
     where id = p_claim_id;
    return null;
  end if;

  v_book := case
    when p_actual_micro is null or p_actual_micro < 0 then v_reserved
    else p_actual_micro
  end;

  update public.quote_spend_daily
     set reserved_micro_usd = greatest(0, reserved_micro_usd - v_reserved),
         spent_micro_usd = spent_micro_usd + v_book
   where day_hkt = v_day;

  if p_outcome = 'failed' then
    update public.quote_analysis_claims
       set status = 'failed'
     where id = p_claim_id;
    return null;
  end if;

  if p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.char_length(p_items::text) > 8000
     or p_page_count is null or p_page_count < 1 or p_page_count > 6
     or p_model_id is null or pg_catalog.char_length(p_model_id) = 0
     or pg_catalog.char_length(p_model_id) > 64 then
    raise exception 'bad_analysis';
  end if;

  insert into public.quote_analyses (
    user_id, day_hkt, page_count, items,
    input_tokens, output_tokens, est_cost_micro_usd, model_id
  ) values (
    v_user, v_day, p_page_count, p_items,
    p_input_tokens, p_output_tokens, v_book, p_model_id
  )
  returning id into v_analysis;

  update public.quote_analysis_claims
     set status = 'succeeded',
         analysis_id = v_analysis
   where id = p_claim_id;

  return v_analysis;
end;
$$;

create or replace function public.take_auth_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer,
  p_max_rows integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cap integer;
  v_count integer;
  v_rows integer;
begin
  if p_bucket is null or p_bucket !~ '^[0-9a-f]{64}$'
     or p_limit is null or p_limit <= 0 or p_limit > 100
     or p_window_seconds is null or p_window_seconds <= 0 or p_window_seconds > 86400
     or p_max_rows is null or p_max_rows <= 0 then
    return false;
  end if;

  v_cap := least(p_max_rows, 5000);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.auth_otp_rate_limits'),
    1
  );

  delete from public.auth_otp_rate_limits
   where reset_at <= pg_catalog.now();

  select hit_count into v_count
    from public.auth_otp_rate_limits
   where bucket = p_bucket
   for update;

  if found then
    if v_count >= p_limit then
      return false;
    end if;
    update public.auth_otp_rate_limits
       set hit_count = hit_count + 1
     where bucket = p_bucket;
    return true;
  end if;

  select count(*)::integer into v_rows
    from public.auth_otp_rate_limits;

  if v_rows >= v_cap then
    return false;
  end if;

  insert into public.auth_otp_rate_limits (bucket, hit_count, reset_at)
  values (
    p_bucket,
    1,
    pg_catalog.now() + pg_catalog.make_interval(secs => p_window_seconds)
  );

  return true;
end;
$$;
