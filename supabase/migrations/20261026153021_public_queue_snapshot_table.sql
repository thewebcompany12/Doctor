create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table if not exists public.public_queue_snapshots (
  queue_id uuid primary key, clinic_code text not null, clinic_slug text, clinic_name text not null, doctor_name text not null,
  specialty text, service_date date not null, queue_status text not null, token_prefix text not null,
  online_booking_enabled boolean not null, walk_in_enabled boolean not null, max_tokens integer,
  average_consultation_minutes integer not null, current_display_token text,
  waiting_count integer not null default 0, completed_count integer not null default 0, updated_at timestamptz not null
);
alter table public.public_queue_snapshots enable row level security;
drop policy if exists public_queue_snapshots_read on public.public_queue_snapshots;
create policy public_queue_snapshots_read on public.public_queue_snapshots for select to anon,authenticated using (true);
grant select on public.public_queue_snapshots to anon,authenticated;
create or replace function private.refresh_public_queue_snapshot(p_queue_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v record; v_current text; v_waiting integer; v_completed integer;
begin
 select q.id as queue_id,c.clinic_code,c.slug as clinic_slug,c.name as clinic_name,d.full_name as doctor_name,d.specialty,
 q.service_date,q.status as queue_status,q.token_prefix,q.online_booking_enabled,q.walk_in_enabled,q.max_tokens,
 q.average_consultation_minutes,q.current_token_id,q.updated_at
 into v from public.queues q join public.clinics c on c.id=q.clinic_id
 join public.doctors d on d.id=q.doctor_id and d.clinic_id=q.clinic_id
 where q.id=p_queue_id and c.is_active and c.is_public and d.is_active and d.is_public;
 if not found then delete from public.public_queue_snapshots where queue_id=p_queue_id; return; end if;
 select t.display_token into v_current from public.queue_tokens t where t.id=v.current_token_id and t.queue_id=v.queue_id and t.status in ('called','in_consultation');
 select count(*)::integer into v_waiting from public.queue_tokens t where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status='waiting';
 select count(*)::integer into v_completed from public.queue_tokens t where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status='completed';
 insert into public.public_queue_snapshots(queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,token_prefix,online_booking_enabled,walk_in_enabled,max_tokens,average_consultation_minutes,current_display_token,waiting_count,completed_count,updated_at)
 values(v.queue_id,v.clinic_code,v.clinic_slug,v.clinic_name,v.doctor_name,v.specialty,v.service_date,v.queue_status,v.token_prefix,v.online_booking_enabled,v.walk_in_enabled,v.max_tokens,v.average_consultation_minutes,v_current,v_waiting,v_completed,now())
 on conflict(queue_id) do update set clinic_code=excluded.clinic_code,clinic_slug=excluded.clinic_slug,clinic_name=excluded.clinic_name,
 doctor_name=excluded.doctor_name,specialty=excluded.specialty,service_date=excluded.service_date,queue_status=excluded.queue_status,
 token_prefix=excluded.token_prefix,online_booking_enabled=excluded.online_booking_enabled,walk_in_enabled=excluded.walk_in_enabled,
 max_tokens=excluded.max_tokens,average_consultation_minutes=excluded.average_consultation_minutes,
 current_display_token=excluded.current_display_token,waiting_count=excluded.waiting_count,completed_count=excluded.completed_count,updated_at=excluded.updated_at;
end;
$$;
create or replace function private.refresh_public_queue_snapshot_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_id uuid; rec record;
begin
 if tg_table_name='queues' then v_id := case when tg_op='DELETE' then old.id else new.id end; perform private.refresh_public_queue_snapshot(v_id);
 elsif tg_table_name='queue_tokens' then v_id := case when tg_op='DELETE' then old.queue_id else new.queue_id end; perform private.refresh_public_queue_snapshot(v_id);
 elsif tg_table_name='clinics' then
  v_id := case when tg_op='DELETE' then old.id else new.id end;
  for rec in select q.id from public.queues q where q.clinic_id=v_id loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
 elsif tg_table_name='doctors' then
  v_id := case when tg_op='DELETE' then old.id else new.id end;
  for rec in select q.id from public.queues q where q.doctor_id=v_id loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.refresh_public_queue_snapshot(uuid) from public,anon,authenticated;
revoke all on function private.refresh_public_queue_snapshot_trigger() from public,anon,authenticated;
drop trigger if exists public_queue_snapshot_queue on public.queues;
create trigger public_queue_snapshot_queue after insert or update or delete on public.queues for each row execute function private.refresh_public_queue_snapshot_trigger();
drop trigger if exists public_queue_snapshot_token on public.queue_tokens;
create trigger public_queue_snapshot_token after insert or update or delete on public.queue_tokens for each row execute function private.refresh_public_queue_snapshot_trigger();
drop trigger if exists public_queue_snapshot_clinic on public.clinics;
create trigger public_queue_snapshot_clinic after insert or update or delete on public.clinics for each row execute function private.refresh_public_queue_snapshot_trigger();
drop trigger if exists public_queue_snapshot_doctor on public.doctors;
create trigger public_queue_snapshot_doctor after insert or update or delete on public.doctors for each row execute function private.refresh_public_queue_snapshot_trigger();
revoke all on function public.get_public_queue_status() from public,anon,authenticated;
drop function if exists public.get_public_queue_status();
