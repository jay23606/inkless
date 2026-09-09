alter table public.il_document_files
  add column mime_type text not null default 'application/octet-stream',
  add column byte_size bigint not null default 0 check (byte_size between 0 and 10485760),
  add column sha256 text not null default '' check (sha256 = '' or sha256 ~ '^[0-9a-f]{64}$');

create table public.il_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);
alter table public.il_rate_limits enable row level security;

create or replace function public.il_check_rate_limit(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare row public.il_rate_limits;
begin
  if p_limit < 1 or p_seconds < 1 then return false; end if;
  insert into public.il_rate_limits(key,window_started_at,request_count) values(p_key,now(),1)
  on conflict(key) do update set
    window_started_at=case when il_rate_limits.window_started_at < now()-make_interval(secs=>p_seconds) then now() else il_rate_limits.window_started_at end,
    request_count=case when il_rate_limits.window_started_at < now()-make_interval(secs=>p_seconds) then 1 else il_rate_limits.request_count+1 end
  returning * into row;
  return row.request_count <= p_limit;
end;
$$;
revoke all on function public.il_check_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.il_check_rate_limit(text,integer,integer) to service_role;
