create or replace function public.create_clinic_queue(
  p_clinic_id uuid,p_doctor_name text,p_specialty text default null,p_token_prefix text default 'T',
  p_max_tokens integer default null,p_online_booking_enabled boolean default false,p_walk_in_enabled boolean default true
)
returns table(queue_id uuid,doctor_id uuid,service_date date)
language plpgsql security definer set search_path=public
as $$
declare v_clinic public.clinics%rowtype; v_doctor public.doctors%rowtype; v_queue public.queues%rowtype;
  v_date date := (timezone('Asia/Kolkata',now()))::date;
  v_name text := left(trim(coalesce(p_doctor_name,'')),120);
  v_prefix text := left(trim(coalesce(p_token_prefix,'T')),8);
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if v_name='' then raise exception 'Doctor name is required' using errcode='22023'; end if;
 if v_prefix='' then raise exception 'Token prefix is required' using errcode='22023'; end if;
 if p_max_tokens is not null and p_max_tokens<1 then raise exception 'Daily token limit must be positive' using errcode='22023'; end if;
 select * into v_clinic from public.clinics where id=p_clinic_id for update;
 if not found or not v_clinic.is_active then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 if not public.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 select * into v_doctor from public.doctors d where d.clinic_id=p_clinic_id and lower(d.full_name)=lower(v_name) and d.is_active order by d.created_at limit 1;
 if not found then
  insert into public.doctors(clinic_id,full_name,specialty,is_active,is_public)
  values(p_clinic_id,v_name,nullif(trim(coalesce(p_specialty,'')),''),true,true) returning * into v_doctor;
 end if;
 select * into v_queue from public.queues q where q.clinic_id=p_clinic_id and q.doctor_id=v_doctor.id and q.service_date=v_date for update;
 if found then
  update public.queues set token_prefix=v_prefix,max_tokens=p_max_tokens,online_booking_enabled=p_online_booking_enabled,walk_in_enabled=p_walk_in_enabled,updated_at=now()
  where id=v_queue.id returning * into v_queue;
 else
  insert into public.queues(clinic_id,doctor_id,service_date,token_prefix,max_tokens,online_booking_enabled,walk_in_enabled)
  values(p_clinic_id,v_doctor.id,v_date,v_prefix,p_max_tokens,p_online_booking_enabled,p_walk_in_enabled) returning * into v_queue;
 end if;
 return query select v_queue.id,v_doctor.id,v_date;
end;
$$;
create or replace function public.set_queue_status(p_queue_id uuid,p_status text)
returns table(queue_id uuid,queue_status text)
language plpgsql security definer set search_path=public
as $$
declare v_queue public.queues%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_status not in ('open','paused','closed') then raise exception 'Unsupported queue status' using errcode='22023'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 if not public.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if v_queue.status='closed' then raise exception 'Closed queue cannot be reopened' using errcode='55000'; end if;
 if p_status='closed' and not public.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor']) then raise exception 'Only owners, managers or doctors can close a queue' using errcode='42501'; end if;
 update public.queues set status=p_status,updated_at=now() where id=v_queue.id returning * into v_queue;
 insert into public.queue_events(clinic_id,queue_id,actor_user_id,event_type,previous_status,new_status)
 values(v_queue.clinic_id,v_queue.id,auth.uid(),'queue_status_changed',v_queue.status,p_status);
 return query select v_queue.id,v_queue.status;
end;
$$;
revoke all on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) from public,anon;
grant execute on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) to authenticated;
revoke all on function public.set_queue_status(uuid,text) from public,anon;
grant execute on function public.set_queue_status(uuid,text) to authenticated;
