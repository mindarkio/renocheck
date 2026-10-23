-- Quote analysis Q1. File only. Do not apply to prod (lvrasvtilgzwtfsfjbzd) from this change.
-- Aaron applies this himself. Pair with supabase/rollbacks/20261023220000_quote_analysis.down.sql
-- No seed data. No PDF bytes. No email addresses.

create table public.quote_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  day_hkt date not null,
  page_count smallint not null check (page_count >= 1 and page_count <= 6),
  items jsonb not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  est_cost_micro_usd bigint check (est_cost_micro_usd is null or est_cost_micro_usd >= 0),
  model_id text not null check (char_length(model_id) <= 64),
  constraint quote_analyses_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint quote_analyses_items_size check (char_length(items::text) <= 8000)
);

create index quote_analyses_user_day_idx on public.quote_analyses (user_id, day_hkt);

alter table public.quote_analyses enable row level security;

create policy quote_analyses_select_own
  on public.quote_analyses
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.quote_analyses from anon;
revoke all on table public.quote_analyses from authenticated;
grant select on table public.quote_analyses to authenticated;
grant select, insert, update, delete on table public.quote_analyses to service_role;

create table public.quote_analysis_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_hkt date not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('claimed', 'succeeded', 'failed')),
  reserved_micro_usd bigint not null check (reserved_micro_usd > 0),
  analysis_id uuid references public.quote_analyses (id) on delete set null
);

create index quote_analysis_claims_user_day_idx
  on public.quote_analysis_claims (user_id, day_hkt, status);

alter table public.quote_analysis_claims enable row level security;

create policy quote_analysis_claims_select_own
  on public.quote_analysis_claims
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.quote_analysis_claims from anon;
revoke all on table public.quote_analysis_claims from authenticated;
grant select on table public.quote_analysis_claims to authenticated;
grant select, insert, update, delete on table public.quote_analysis_claims to service_role;

-- Global daily spend. No per-user columns. RLS on, no policies.
create table public.quote_spend_daily (
  day_hkt date primary key,
  spent_micro_usd bigint not null default 0 check (spent_micro_usd >= 0),
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  calls integer not null default 0 check (calls >= 0)
);

alter table public.quote_spend_daily enable row level security;

revoke all on table public.quote_spend_daily from anon, authenticated;
grant select, insert, update, delete on table public.quote_spend_daily to service_role;

-- Day boundary is the database clock in Asia/Hong_Kong, not the app clock.
-- Cap and the per-account limit are arguments so the env default can change without a migration.
create or replace function public.begin_quote_analysis(
  p_user_id uuid,
  p_reserve bigint,
  p_daily_limit integer,
  p_cap_micro bigint
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
begin
  if p_user_id is null
     or p_reserve is null or p_reserve <= 0
     or p_daily_limit is null or p_daily_limit <= 0
     or p_cap_micro is null or p_cap_micro < 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'bad_args');
  end if;

  insert into public.quote_spend_daily (day_hkt) values (v_day)
  on conflict (day_hkt) do nothing;

  select spent_micro_usd, reserved_micro_usd
    into v_spent, v_reserved
    from public.quote_spend_daily
   where day_hkt = v_day
   for update;

  with stale as (
    select id, reserved_micro_usd
      from public.quote_analysis_claims
     where status = 'claimed'
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
     set reserved_micro_usd = pg_catalog.greatest(0, d.reserved_micro_usd - t.total),
         spent_micro_usd = d.spent_micro_usd + t.total
    from (
      select coalesce(sum(reserved_micro_usd), 0) as total
        from released
    ) as t
   where d.day_hkt = v_day
     and t.total > 0;

  select spent_micro_usd, reserved_micro_usd
    into v_spent, v_reserved
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

  if v_spent + v_reserved + p_reserve > p_cap_micro then
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
       set reserved_micro_usd = pg_catalog.greatest(0, reserved_micro_usd - v_reserved)
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
     set reserved_micro_usd = pg_catalog.greatest(0, reserved_micro_usd - v_reserved),
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

revoke all on function public.begin_quote_analysis(uuid, bigint, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.begin_quote_analysis(uuid, bigint, integer, bigint)
  to service_role;

revoke all on function public.finish_quote_analysis(uuid, text, bigint, smallint, jsonb, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.finish_quote_analysis(uuid, text, bigint, smallint, jsonb, integer, integer, text)
  to service_role;
