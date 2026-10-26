create table if not exists public.public_clinic_directory (clinic_code text primary key,clinic_slug text unique,clinic_name text not null,description text,address text,city text,state text,postal_code text,public_phone text,timezone text not null default 'Asia/Kolkata',doctor_names text[] not null default '{}',specialties text[] not null default '{}',updated_at timestamptz not null default now());
alter table public.public_clinic_directory enable row level security;
drop policy if exists public_clinic_directory_read on public.public_clinic_directory;
create policy public_clinic_directory_read on public.public_clinic_directory for select to anon,authenticated using (true);
revoke all privileges on public.public_clinic_directory from public;
grant select on public.public_clinic_directory to anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.public_clinic_directory from anon,authenticated;
create or replace function private.refresh_public_clinic_directory(p_clinic_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v record; v_names text[]; v_specialties text[];
begin
 select c.clinic_code,c.slug,c.name,c.description,c.address,c.city,c.state,c.postal_code,c.phone,c.timezone,c.is_active,c.is_public into v from public.clinics c where c.id=p_clinic_id;
 if not found or not v.is_active or not v.is_public then
  delete from public.public_clinic_directory where clinic_code=(select c.clinic_code from public.clinics c where c.id=p_clinic_id);
  return;
 end if;
 select coalesce(array_agg(d.full_name order by d.full_name),'{}'::text[]),coalesce(array_agg(distinct d.specialty order by d.specialty) filter(where d.specialty is not null and trim(d.specialty)<>''),'{}'::text[]) into v_names,v_specialties from public.doctors d where d.clinic_id=p_clinic_id and d.is_active and d.is_public;
 insert into public.public_clinic_directory(clinic_code,clinic_slug,clinic_name,description,address,city,state,postal_code,public_phone,timezone,doctor_names,specialties,updated_at)
 values(v.clinic_code,v.slug,v.name,v.description,v.address,v.city,v.state,v.postal_code,v.phone,coalesce(v.timezone,'Asia/Kolkata'),v_names,v_specialties,now())
 on conflict(clinic_code) do update set clinic_slug=excluded.clinic_slug,clinic_name=excluded.clinic_name,description=excluded.description,address=excluded.address,city=excluded.city,state=excluded.state,postal_code=excluded.postal_code,public_phone=excluded.public_phone,timezone=excluded.timezone,doctor_names=excluded.doctor_names,specialties=excluded.specialties,updated_at=excluded.updated_at;
end; $$;
revoke all on function private.refresh_public_clinic_directory(uuid) from public,anon,authenticated,service_role;
create or replace function private.refresh_public_clinic_directory_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if tg_table_name='clinics' then
  if tg_op<>'INSERT' then perform private.refresh_public_clinic_directory(old.id); end if;
  if tg_op<>'DELETE' then perform private.refresh_public_clinic_directory(new.id); end if;
 elsif tg_table_name='doctors' then
  if tg_op<>'INSERT' then perform private.refresh_public_clinic_directory(old.clinic_id); end if;
  if tg_op<>'DELETE' and (tg_op<>'UPDATE' or old.clinic_id is distinct from new.clinic_id) then perform private.refresh_public_clinic_directory(new.clinic_id); end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.refresh_public_clinic_directory_trigger() from public,anon,authenticated,service_role;
drop trigger if exists public_clinic_directory_clinic on public.clinics;
create trigger public_clinic_directory_clinic after insert or update or delete on public.clinics for each row execute function private.refresh_public_clinic_directory_trigger();
drop trigger if exists public_clinic_directory_doctor on public.doctors;
create trigger public_clinic_directory_doctor after insert or update or delete on public.doctors for each row execute function private.refresh_public_clinic_directory_trigger();
do $$ declare rec record; begin
 for rec in select id from public.clinics loop perform private.refresh_public_clinic_directory(rec.id); end loop;
 for rec in select id from public.queues loop perform private.refresh_public_queue_snapshot(rec.id); end loop;
end; $$;