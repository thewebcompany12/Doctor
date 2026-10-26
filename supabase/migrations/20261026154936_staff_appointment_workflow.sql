create or replace function public.create_staff_appointment(
 p_clinic_id uuid,p_doctor_id uuid,p_branch_id uuid,p_patient_name text,p_appointment_date date,p_appointment_time time,p_idempotency_key text default null
)
returns table(appointment_id uuid,appointment_status text)
language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_clinic public.clinics%rowtype; v_doctor public.doctors%rowtype; v_branch public.clinic_branches%rowtype;
 v_hours public.clinic_hours%rowtype; v_appointment public.appointments%rowtype; v_name text:=left(trim(coalesce(p_patient_name,'')),120); v_weekday integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager','doctor','receptionist']) then raise exception 'Receptionist or clinical staff permission required' using errcode='42501'; end if;
 if v_name='' then raise exception 'Patient name is required' using errcode='22023'; end if;
 if p_appointment_date < (timezone('Asia/Kolkata',now()))::date then raise exception 'Appointment cannot be scheduled in the past' using errcode='22023'; end if;
 select * into v_clinic from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select * into v_doctor from public.doctors where id=p_doctor_id and clinic_id=p_clinic_id and is_active;
 if not found then raise exception 'Active doctor not found in this clinic' using errcode='P0002'; end if;
 if p_branch_id is not null then
  select * into v_branch from public.clinic_branches where id=p_branch_id and clinic_id=p_clinic_id and is_active;
  if not found then raise exception 'Active branch not found in this clinic' using errcode='P0002'; end if;
 end if;
 if p_idempotency_key is not null then
  select * into v_appointment from public.appointments where clinic_id=p_clinic_id and idempotency_key=p_idempotency_key;
  if found then return query select v_appointment.id,v_appointment.status; return; end if;
 end if;
 v_weekday:=extract(dow from p_appointment_date)::integer;
 select * into v_hours from public.clinic_hours where clinic_id=p_clinic_id and doctor_id=p_doctor_id and weekday=v_weekday limit 1;
 if not found then select * into v_hours from public.clinic_hours where clinic_id=p_clinic_id and doctor_id is null and weekday=v_weekday limit 1; end if;
 if not found or v_hours.is_closed or v_hours.opens_at is null or v_hours.closes_at is null
    or p_appointment_time < v_hours.opens_at or p_appointment_time >= v_hours.closes_at then
  raise exception 'Appointment time is outside configured opening hours' using errcode='22023';
 end if;
 insert into public.appointments(clinic_id,branch_id,doctor_id,patient_name,appointment_date,appointment_time,status,booking_source,created_by,idempotency_key)
 values(p_clinic_id,p_branch_id,p_doctor_id,v_name,p_appointment_date,p_appointment_time,'booked','staff',auth.uid(),p_idempotency_key)
 returning * into v_appointment;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(p_clinic_id,auth.uid(),'appointment.created','appointment',v_appointment.id,
   jsonb_build_object('doctor_id',p_doctor_id,'appointment_date',p_appointment_date,'appointment_time',p_appointment_time));
 return query select v_appointment.id,v_appointment.status;
end;
$$;
revoke all on function public.create_staff_appointment(uuid,uuid,uuid,text,date,time,text) from public,anon;
grant execute on function public.create_staff_appointment(uuid,uuid,uuid,text,date,time,text) to authenticated;

create or replace function public.transition_staff_appointment(p_appointment_id uuid,p_action text)
returns table(appointment_id uuid,appointment_status text)
language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_appointment public.appointments%rowtype; v_next text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_appointment from public.appointments where id=p_appointment_id for update;
 if not found then raise exception 'Appointment not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_appointment.clinic_id,array['owner','manager','doctor','receptionist']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 v_next:=case
  when p_action='confirm' and v_appointment.status='booked' then 'confirmed'
  when p_action='check_in' and v_appointment.status in ('booked','confirmed') then 'checked_in'
  when p_action='complete' and v_appointment.status='checked_in' then 'completed'
  when p_action='cancel' and v_appointment.status in ('booked','confirmed') then 'cancelled'
  when p_action='no_show' and v_appointment.status in ('booked','confirmed') then 'no_show'
  else null
 end;
 if v_next is null then raise exception 'Invalid appointment status transition' using errcode='55000'; end if;
 update public.appointments set status=v_next,updated_at=now() where id=v_appointment.id returning * into v_appointment;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(v_appointment.clinic_id,auth.uid(),'appointment.'||p_action,'appointment',v_appointment.id,
  jsonb_build_object('previous_status',v_appointment.status,'new_status',v_next));
 return query select v_appointment.id,v_appointment.status;
end;
$$;
revoke all on function public.transition_staff_appointment(uuid,text) from public,anon;
grant execute on function public.transition_staff_appointment(uuid,text) to authenticated;
