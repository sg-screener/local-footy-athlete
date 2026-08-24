create schema if not exists private;

create table if not exists private.coach_rate_limits (
  client_key text primary key,
  window_started_at timestamptz not null,
  requests integer not null check (requests > 0),
  last_seen_at timestamptz not null
);

create index if not exists coach_rate_limits_last_seen_idx
  on private.coach_rate_limits (last_seen_at);

revoke all on table private.coach_rate_limits from public, anon, authenticated;

create or replace function public.check_coach_rate_limit(
  p_client_key text,
  p_window_seconds integer,
  p_client_max_requests integer,
  p_global_max_requests integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  scope text
)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_global private.coach_rate_limits%rowtype;
  v_client private.coach_rate_limits%rowtype;
begin
  if p_client_key !~ '^[0-9a-f]{64}$'
    or p_window_seconds <= 0
    or p_client_max_requests <= 0
    or p_global_max_requests < p_client_max_requests then
    raise exception 'invalid coach rate-limit input';
  end if;

  v_window := make_interval(secs => p_window_seconds);
  delete from private.coach_rate_limits
    where last_seen_at < v_now - interval '1 hour';

  insert into private.coach_rate_limits as limits (
    client_key,
    window_started_at,
    requests,
    last_seen_at
  ) values (
    'global:coach-chat',
    v_now,
    1,
    v_now
  )
  on conflict (client_key) do update set
    window_started_at = case
      when limits.window_started_at + v_window <= v_now then v_now
      else limits.window_started_at
    end,
    requests = case
      when limits.window_started_at + v_window <= v_now then 1
      else limits.requests + 1
    end,
    last_seen_at = v_now
  returning * into v_global;

  if v_global.requests > p_global_max_requests then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (
        v_global.window_started_at + v_window - v_now
      )))::integer),
      'global'::text;
    return;
  end if;

  insert into private.coach_rate_limits as limits (
    client_key,
    window_started_at,
    requests,
    last_seen_at
  ) values (
    p_client_key,
    v_now,
    1,
    v_now
  )
  on conflict (client_key) do update set
    window_started_at = case
      when limits.window_started_at + v_window <= v_now then v_now
      else limits.window_started_at
    end,
    requests = case
      when limits.window_started_at + v_window <= v_now then 1
      else limits.requests + 1
    end,
    last_seen_at = v_now
  returning * into v_client;

  return query select
    v_client.requests <= p_client_max_requests,
    case
      when v_client.requests <= p_client_max_requests then 0
      else greatest(1, ceil(extract(epoch from (
        v_client.window_started_at + v_window - v_now
      )))::integer)
    end,
    'client'::text;
end;
$$;

revoke all on function public.check_coach_rate_limit(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_coach_rate_limit(text, integer, integer, integer)
  to service_role;
