create or replace function private.update_clinic_profile(
  p_clinic_id uuid, p_name text, p_address text, p_city text, p_state text, p_phone text
) returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_before public.clinics%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 if nullif(trim(coalesce(p_name,'')),'') is null or length(trim(p_name))>120 then raise exception 'Valid clinic name is required' using errcode='22023'; end if;
 select * into v_before from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 update public.clinics set name=trim(p_name),address=nullif(trim(coalesce(p_address,'')),''),city=nullif(trim(coalesce(p_city,'')),''),state=nullif(trim(coalesce(p_state,'')),''),phone=nullif(trim(coalesce(p_phone,'')),''),updated_at=now() where id=p_clinic_id;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(p_clinic_id,auth.uid(),'clinic.profile_updated','clinic',p_clinic_id,jsonb_build_object('before',jsonb_build_object('name',v_before.name,'address',v_before.address,'city',v_before.city,'state',v_before.state,'phone',v_before.phone),'after',jsonb_build_object('name',trim(p_name),'address',nullif(trim(coalesce(p_address,'')),''),'city',nullif(trim(coalesce(p_city,'')),''),'state',nullif(trim(coalesce(p_state,'')),''),'phone',nullif(trim(coalesce(p_phone,'')),''))));
end; $$;
create or replace function private.create_clinic_branch(
 p_clinic_id uuid,p_branch_code text,p_name text,p_address text default null,p_city text default null,p_state text default null,p_postal_code text default null,p_phone text default null
) returns table(branch_id uuid,branch_code text,branch_name text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_branch public.clinic_branches%rowtype; v_code text:=upper(trim(coalesce(p_branch_code,''))); v_name text:=trim(coalesce(p_name,''));
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 if v_code !~ '^[A-Z0-9-]{2,16}$' then raise exception 'Branch code must be 2–16 letters, numbers or hyphens' using errcode='22023'; end if;
 if v_name='' or length(v_name)>120 then raise exception 'Valid branch name is required' using errcode='22023'; end if;
 perform 1 from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 insert into public.clinic_branches(clinic_id,branch_code,name,address,city,state,postal_code,phone)
 values(p_clinic_id,v_code,v_name,nullif(trim(coalesce(p_address,'')),''),nullif(trim(coalesce(p_city,'')),''),nullif(trim(coalesce(p_state,'')),''),nullif(trim(coalesce(p_postal_code,'')),''),nullif(trim(coalesce(p_phone,'')),''))
 returning * into v_branch;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(p_clinic_id,auth.uid(),'clinic.branch_created','branch',v_branch.id,jsonb_build_object('branch_code',v_code,'name',v_name));
 return query select v_branch.id,v_branch.branch_code,v_branch.name;
end; $$;
create or replace function private.set_clinic_hours(
 p_clinic_id uuid,p_doctor_id uuid,p_weekday smallint,p_opens_at time,p_closes_at time,p_is_closed boolean default false
) returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_hour public.clinic_hours%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager','doctor']) then raise exception 'Schedule management permission required' using errcode='42501'; end if;
 if p_weekday not between 0 and 6 then raise exception 'Weekday must be between 0 and 6' using errcode='22023'; end if;
 if not p_is_closed and (p_opens_at is null or p_closes_at is null or p_closes_at<=p_opens_at) then raise exception 'Closing time must be after opening time' using errcode='22023'; end if;
 perform 1 from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 if p_doctor_id is not null and not exists(select 1 from public.doctors where id=p_doctor_id and clinic_id=p_clinic_id) then raise exception 'Doctor does not belong to this clinic' using errcode='42501'; end if;
 select * into v_hour from public.clinic_hours h where h.clinic_id=p_clinic_id and h.doctor_id is not distinct from p_doctor_id and h.weekday=p_weekday limit 1 for update;
 if found then update public.clinic_hours set opens_at=case when p_is_closed then null else p_opens_at end,closes_at=case when p_is_closed then null else p_closes_at end,is_closed=p_is_closed where id=v_hour.id;
 else insert into public.clinic_hours(clinic_id,doctor_id,weekday,opens_at,closes_at,is_closed) values(p_clinic_id,p_doctor_id,p_weekday,case when p_is_closed then null else p_opens_at end,case when p_is_closed then null else p_closes_at end,p_is_closed);
 end if;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(p_clinic_id,auth.uid(),'clinic.hours_updated','clinic_hours',null,jsonb_build_object('doctor_id',p_doctor_id,'weekday',p_weekday,'closed',p_is_closed,'opens_at',p_opens_at,'closes_at',p_closes_at));
end; $$;
revoke all on function private.update_clinic_profile(uuid,text,text,text,text,text) from public,anon;
revoke all on function private.create_clinic_branch(uuid,text,text,text,text,text,text,text) from public,anon;
revoke all on function private.set_clinic_hours(uuid,uuid,smallint,time,time,boolean) from public,anon;
grant execute on function private.update_clinic_profile(uuid,text,text,text,text,text) to authenticated;
grant execute on function private.create_clinic_branch(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function private.set_clinic_hours(uuid,uuid,smallint,time,time,boolean) to authenticated;
create or replace function public.update_clinic_profile(p_clinic_id uuid,p_name text,p_address text,p_city text,p_state text,p_phone text)
returns void language sql security invoker set search_path=pg_catalog,public,private as $$ select private.update_clinic_profile($1,$2,$3,$4,$5,$6); $$;
create or replace function public.create_clinic_branch(p_clinic_id uuid,p_branch_code text,p_name text,p_address text default null,p_city text default null,p_state text default null,p_postal_code text default null,p_phone text default null)
returns table(branch_id uuid,branch_code text,branch_name text) language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.create_clinic_branch($1,$2,$3,$4,$5,$6,$7,$8); $$;
create or replace function public.set_clinic_hours(p_clinic_id uuid,p_doctor_id uuid,p_weekday smallint,p_opens_at time,p_closes_at time,p_is_closed boolean default false)
returns void language sql security invoker set search_path=pg_catalog,public,private as $$ select private.set_clinic_hours($1,$2,$3,$4,$5,$6); $$;
revoke all on function public.update_clinic_profile(uuid,text,text,text,text,text) from public,anon;
revoke all on function public.create_clinic_branch(uuid,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.set_clinic_hours(uuid,uuid,smallint,time,time,boolean) from public,anon;
grant execute on function public.update_clinic_profile(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.create_clinic_branch(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.set_clinic_hours(uuid,uuid,smallint,time,time,boolean) to authenticated;
