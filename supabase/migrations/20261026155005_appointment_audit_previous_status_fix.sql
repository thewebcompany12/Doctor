create or replace function public.transition_staff_appointment(p_appointment_id uuid,p_action text)
returns table(appointment_id uuid,appointment_status text)
language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_appointment public.appointments%rowtype; v_next text; v_previous text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_appointment from public.appointments where id=p_appointment_id for update;
 if not found then raise exception 'Appointment not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_appointment.clinic_id,array['owner','manager','doctor','receptionist']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 v_previous:=v_appointment.status;
 v_next:=case
  when p_action='confirm' and v_previous='booked' then 'confirmed'
  when p_action='check_in' and v_previous in ('booked','confirmed') then 'checked_in'
  when p_action='complete' and v_previous='checked_in' then 'completed'
  when p_action='cancel' and v_previous in ('booked','confirmed') then 'cancelled'
  when p_action='no_show' and v_previous in ('booked','confirmed') then 'no_show'
  else null
 end;
 if v_next is null then raise exception 'Invalid appointment status transition' using errcode='55000'; end if;
 update public.appointments set status=v_next,updated_at=now() where id=v_appointment.id returning * into v_appointment;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(v_appointment.clinic_id,auth.uid(),'appointment.'||p_action,'appointment',v_appointment.id,jsonb_build_object('previous_status',v_previous,'new_status',v_next));
 return query select v_appointment.id,v_appointment.status;
end;
$$;
revoke all on function public.transition_staff_appointment(uuid,text) from public,anon;
grant execute on function public.transition_staff_appointment(uuid,text) to authenticated;
