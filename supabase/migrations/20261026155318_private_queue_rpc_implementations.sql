do $$
declare r record; definition text;
begin
 for r in
  select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f'
    and p.proname in ('advance_queue','create_clinic_queue','create_staff_appointment','issue_staff_token','set_queue_status','transition_queue_token','transition_staff_appointment')
 loop
  definition:=pg_get_functiondef(r.oid);
  definition:=replace(definition,'FUNCTION public.'||r.proname||'(','FUNCTION private.'||r.proname||'_impl(');
  execute definition;
 end loop;
end;
$$;
revoke all on function private.advance_queue_impl(uuid,text) from public,anon,authenticated;
revoke all on function private.create_clinic_queue_impl(uuid,text,text,text,integer,boolean,boolean) from public,anon,authenticated;
revoke all on function private.create_staff_appointment_impl(uuid,uuid,uuid,text,date,time,text) from public,anon,authenticated;
revoke all on function private.issue_staff_token_impl(uuid,text,text) from public,anon,authenticated;
revoke all on function private.set_queue_status_impl(uuid,text) from public,anon,authenticated;
revoke all on function private.transition_queue_token_impl(uuid,text,text,text) from public,anon,authenticated;
revoke all on function private.transition_staff_appointment_impl(uuid,text) from public,anon,authenticated;
grant execute on function private.advance_queue_impl(uuid,text) to authenticated;
grant execute on function private.create_clinic_queue_impl(uuid,text,text,text,integer,boolean,boolean) to authenticated;
grant execute on function private.create_staff_appointment_impl(uuid,uuid,uuid,text,date,time,text) to authenticated;
grant execute on function private.issue_staff_token_impl(uuid,text,text) to authenticated;
grant execute on function private.set_queue_status_impl(uuid,text) to authenticated;
grant execute on function private.transition_queue_token_impl(uuid,text,text,text) to authenticated;
grant execute on function private.transition_staff_appointment_impl(uuid,text) to authenticated;
create or replace function public.advance_queue(p_queue_id uuid,p_idempotency_key text default null)
returns table(token_id uuid,token_number integer,display_token text,token_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.advance_queue_impl(p_queue_id,p_idempotency_key); $$;
create or replace function public.create_clinic_queue(p_clinic_id uuid,p_doctor_name text,p_specialty text default null,p_token_prefix text default 'T',p_max_tokens integer default null,p_online_booking_enabled boolean default false,p_walk_in_enabled boolean default true)
returns table(queue_id uuid,doctor_id uuid,service_date date)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.create_clinic_queue_impl(p_clinic_id,p_doctor_name,p_specialty,p_token_prefix,p_max_tokens,p_online_booking_enabled,p_walk_in_enabled); $$;
create or replace function public.create_staff_appointment(p_clinic_id uuid,p_doctor_id uuid,p_branch_id uuid,p_patient_name text,p_appointment_date date,p_appointment_time time,p_idempotency_key text default null)
returns table(appointment_id uuid,appointment_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.create_staff_appointment_impl(p_clinic_id,p_doctor_id,p_branch_id,p_patient_name,p_appointment_date,p_appointment_time,p_idempotency_key); $$;
create or replace function public.issue_staff_token(p_queue_id uuid,p_patient_label text default 'Patient',p_idempotency_key text default null)
returns table(token_id uuid,token_number integer,display_token text,token_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.issue_staff_token_impl(p_queue_id,p_patient_label,p_idempotency_key); $$;
create or replace function public.set_queue_status(p_queue_id uuid,p_status text)
returns table(queue_id uuid,queue_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.set_queue_status_impl(p_queue_id,p_status); $$;
create or replace function public.transition_queue_token(p_token_id uuid,p_action text,p_reason text default null,p_idempotency_key text default null)
returns table(token_id uuid,display_token text,token_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.transition_queue_token_impl(p_token_id,p_action,p_reason,p_idempotency_key); $$;
create or replace function public.transition_staff_appointment(p_appointment_id uuid,p_action text)
returns table(appointment_id uuid,appointment_status text)
language sql security invoker set search_path=pg_catalog,public,private as $$ select * from private.transition_staff_appointment_impl(p_appointment_id,p_action); $$;
revoke all on function public.advance_queue(uuid,text) from public,anon;
revoke all on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) from public,anon;
revoke all on function public.create_staff_appointment(uuid,uuid,uuid,text,date,time,text) from public,anon;
revoke all on function public.issue_staff_token(uuid,text,text) from public,anon;
revoke all on function public.set_queue_status(uuid,text) from public,anon;
revoke all on function public.transition_queue_token(uuid,text,text,text) from public,anon;
revoke all on function public.transition_staff_appointment(uuid,text) from public,anon;
grant execute on function public.advance_queue(uuid,text) to authenticated;
grant execute on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.create_staff_appointment(uuid,uuid,uuid,text,date,time,text) to authenticated;
grant execute on function public.issue_staff_token(uuid,text,text) to authenticated;
grant execute on function public.set_queue_status(uuid,text) to authenticated;
grant execute on function public.transition_queue_token(uuid,text,text,text) to authenticated;
grant execute on function public.transition_staff_appointment(uuid,text) to authenticated;
