-- Patient experience: safe directory metadata, live queue hours, push subscriptions,
-- rate-limited tracking, and cancellation using the one-time bearer secret.
alter table public.public_queue_snapshots
  add column if not exists clinic_city text,
  add column if not exists clinic_address text,
  add column if not exists opens_at time,
  add column if not exists closes_at time,
  add column if not exists is_closed boolean not null default true;

create table if not exists private.public_tracking_rate_limits (
  rate_key_hash text primary key check (rate_key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists public_tracking_rate_limits_updated_idx
  on private.public_tracking_rate_limits(updated_at);
revoke all on table private.public_tracking_rate_limits from public, anon, authenticated, service_role;

create table if not exists public.push_subscriptions (
  endpoint_hash text primary key check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  token_id uuid not null references public.queue_tokens(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  expiration_time timestamptz,
  enabled boolean not null default true,
  preferences jsonb not null default '{"turn_approaching":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscription_endpoint_https check (endpoint like 'https://%')
);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
create index if not exists push_subscriptions_token_enabled_idx
  on public.push_subscriptions(token_id,enabled);

create or replace function private.refresh_public_queue_snapshot(p_queue_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare
 v record; v_current text; v_waiting integer; v_completed integer;
 v_opens_at time; v_closes_at time; v_is_closed boolean:=true; v_online_plan_enabled boolean:=false;
 v_weekday integer;
begin
 select q.id as queue_id,c.clinic_code,c.slug as clinic_slug,c.name as clinic_name,c.city as clinic_city,
 c.address as clinic_address,c.timezone,d.full_name as doctor_name,d.specialty,q.service_date,q.status as queue_status,
 q.token_prefix,q.online_booking_enabled,q.walk_in_enabled,q.max_tokens,q.average_consultation_minutes,
 q.current_token_id,q.updated_at,q.clinic_id,q.doctor_id
 into v
 from public.queues q join public.clinics c on c.id=q.clinic_id
 join public.doctors d on d.id=q.doctor_id and d.clinic_id=q.clinic_id
 where q.id=p_queue_id and c.is_active and c.is_public and d.is_active and d.is_public;
 if not found then delete from public.public_queue_snapshots where queue_id=p_queue_id; return; end if;

 select t.display_token into v_current from public.queue_tokens t
 where t.id=v.current_token_id and t.queue_id=v.queue_id and t.status in ('called','in_consultation');
 select count(*)::integer into v_waiting from public.queue_tokens t
 where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status='waiting';
 select count(*)::integer into v_completed from public.queue_tokens t
 where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status='completed';

 v_weekday:=extract(dow from (timezone(coalesce(v.timezone,'Asia/Kolkata'),now()))::date)::integer;
 select h.opens_at,h.closes_at,h.is_closed into v_opens_at,v_closes_at,v_is_closed
 from public.clinic_hours h
 where h.clinic_id=v.clinic_id and h.weekday=v_weekday
   and (h.doctor_id=v.doctor_id or h.doctor_id is null)
 order by (h.doctor_id is not null) desc,h.created_at desc limit 1;
 if not found then v_opens_at:=null; v_closes_at:=null; v_is_closed:=true; end if;
 select coalesce((s.settings #>> '{subscription,booking,online}')::boolean,false)
 into v_online_plan_enabled from public.clinic_settings s where s.clinic_id=v.clinic_id;
 v_online_plan_enabled:=coalesce(v_online_plan_enabled,false);

 insert into public.public_queue_snapshots(
  queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,token_prefix,
  online_booking_enabled,walk_in_enabled,max_tokens,average_consultation_minutes,current_display_token,
  waiting_count,completed_count,updated_at,clinic_city,clinic_address,opens_at,closes_at,is_closed
 )
 values(
  v.queue_id,v.clinic_code,v.clinic_slug,v.clinic_name,v.doctor_name,v.specialty,v.service_date,v.queue_status,v.token_prefix,
  (v.online_booking_enabled and v_online_plan_enabled),v.walk_in_enabled,v.max_tokens,v.average_consultation_minutes,
  v_current,v_waiting,v_completed,now(),v.clinic_city,v.clinic_address,v_opens_at,v_closes_at,v_is_closed
 )
 on conflict(queue_id) do update set
  clinic_code=excluded.clinic_code,clinic_slug=excluded.clinic_slug,clinic_name=excluded.clinic_name,
  doctor_name=excluded.doctor_name,specialty=excluded.specialty,service_date=excluded.service_date,
  queue_status=excluded.queue_status,token_prefix=excluded.token_prefix,
  online_booking_enabled=excluded.online_booking_enabled,walk_in_enabled=excluded.walk_in_enabled,
  max_tokens=excluded.max_tokens,average_consultation_minutes=excluded.average_consultation_minutes,
  current_display_token=excluded.current_display_token,waiting_count=excluded.waiting_count,
  completed_count=excluded.completed_count,updated_at=excluded.updated_at,
  clinic_city=excluded.clinic_city,clinic_address=excluded.clinic_address,
  opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed;
end;
$$;
revoke all on function private.refresh_public_queue_snapshot(uuid) from public,anon,authenticated,service_role;

create or replace function private.refresh_patient_snapshot_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_clinic_id uuid; v_doctor_id uuid; rec record;
begin
 if tg_table_name='clinic_hours' then
  if tg_op<>'INSERT' then
   for rec in select q.id from public.queues q where q.clinic_id=old.clinic_id and (old.doctor_id is null or q.doctor_id=old.doctor_id)
   loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
  end if;
  if tg_op<>'DELETE' then
   for rec in select q.id from public.queues q where q.clinic_id=new.clinic_id and (new.doctor_id is null or q.doctor_id=new.doctor_id)
   loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
  end if;
 elsif tg_table_name='clinic_settings' then
  v_clinic_id:=case when tg_op='DELETE' then old.clinic_id else new.clinic_id end;
  for rec in select q.id from public.queues q where q.clinic_id=v_clinic_id
  loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.refresh_patient_snapshot_trigger() from public,anon,authenticated,service_role;
drop trigger if exists public_queue_snapshot_hours on public.clinic_hours;
create trigger public_queue_snapshot_hours after insert or update or delete on public.clinic_hours
for each row execute function private.refresh_patient_snapshot_trigger();
drop trigger if exists public_queue_snapshot_settings on public.clinic_settings;
create trigger public_queue_snapshot_settings after insert or update or delete on public.clinic_settings
for each row execute function private.refresh_patient_snapshot_trigger();

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_queue_snapshots') then
  execute 'alter publication supabase_realtime add table public.public_queue_snapshots';
 end if;
end;
$$;

create or replace function private.consume_public_tracking_rate_limit_impl(p_rate_key_hash text)
returns boolean language plpgsql security definer set search_path=pg_catalog,private
as $$
declare v_count integer;
begin
 if p_rate_key_hash is null or p_rate_key_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 insert into private.public_tracking_rate_limits(rate_key_hash,window_started_at,request_count,updated_at)
 values(p_rate_key_hash,now(),1,now())
 on conflict(rate_key_hash) do update set
  request_count=case when private.public_tracking_rate_limits.window_started_at<now()-interval '15 minutes' then 1 else private.public_tracking_rate_limits.request_count+1 end,
  window_started_at=case when private.public_tracking_rate_limits.window_started_at<now()-interval '15 minutes' then now() else private.public_tracking_rate_limits.window_started_at end,
  updated_at=now()
 returning request_count into v_count;
 if v_count=1 then delete from private.public_tracking_rate_limits where updated_at<now()-interval '2 days' and rate_key_hash<>p_rate_key_hash; end if;
 return v_count<=60;
end;
$$;
revoke all on function private.consume_public_tracking_rate_limit_impl(text) from public,anon,authenticated,service_role;
grant execute on function private.consume_public_tracking_rate_limit_impl(text) to service_role;
create or replace function public.consume_public_tracking_rate_limit(p_rate_key_hash text)
returns boolean language sql security invoker set search_path=pg_catalog,public,private
as $$ select private.consume_public_tracking_rate_limit_impl($1); $$;
revoke all on function public.consume_public_tracking_rate_limit(text) from public,anon,authenticated;
grant execute on function public.consume_public_tracking_rate_limit(text) to service_role;

create or replace function private.cancel_public_queue_token_impl(p_tracking_secret_hash text)
returns table(display_token text,token_status text,tracking_expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_token public.queue_tokens%rowtype;
begin
 if p_tracking_secret_hash is null or p_tracking_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid tracking secret' using errcode='22023'; end if;
 select * into v_token from public.queue_tokens
 where tracking_secret_hash=p_tracking_secret_hash and tracking_expires_at>now() and tracking_revoked_at is null
 for update;
 if not found then raise exception 'Token not found or expired' using errcode='P0002'; end if;
 if v_token.status<>'waiting' then raise exception 'Only waiting tokens can be cancelled online' using errcode='55000'; end if;
 update public.queue_tokens set status='cancelled',updated_at=now()
 where id=v_token.id returning * into v_token;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,previous_status,new_status,metadata)
 values(v_token.clinic_id,v_token.queue_id,v_token.id,null,'online_token_cancelled','waiting','cancelled',jsonb_build_object('booking_source','online'));
 return query select v_token.display_token,v_token.status,v_token.tracking_expires_at;
end;
$$;
revoke all on function private.cancel_public_queue_token_impl(text) from public,anon,authenticated,service_role;
grant execute on function private.cancel_public_queue_token_impl(text) to service_role;
create or replace function public.cancel_public_queue_token(p_tracking_secret_hash text)
returns table(display_token text,token_status text,tracking_expires_at timestamptz)
language sql security invoker set search_path=pg_catalog,public,private
as $$ select * from private.cancel_public_queue_token_impl($1); $$;
revoke all on function public.cancel_public_queue_token(text) from public,anon,authenticated;
grant execute on function public.cancel_public_queue_token(text) to service_role;
