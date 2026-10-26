create or replace function private.set_clinic_branch_active(p_clinic_id uuid,p_branch_id uuid,p_is_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_branch public.clinic_branches%rowtype; v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 perform 1 from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select * into v_branch from public.clinic_branches where id=p_branch_id and clinic_id=p_clinic_id for update;
 if not found then raise exception 'Branch not found in this clinic' using errcode='P0002'; end if;
 if p_is_active and not v_branch.is_active then select count(*)::integer into v_count from public.clinic_branches where clinic_id=p_clinic_id and is_active; perform private.enforce_clinic_usage_limit(p_clinic_id,'branches',v_count); end if;
 update public.clinic_branches set is_active=p_is_active,updated_at=now() where id=v_branch.id;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata) values(p_clinic_id,auth.uid(),case when p_is_active then 'clinic.branch_activated' else 'clinic.branch_deactivated' end,'branch',v_branch.id,jsonb_build_object('branch_code',v_branch.branch_code,'previous_active',v_branch.is_active,'is_active',p_is_active));
end; $$;
create or replace function private.update_clinic_doctor(p_clinic_id uuid,p_doctor_id uuid,p_full_name text,p_specialty text,p_is_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_doctor public.doctors%rowtype; v_name text:=left(trim(coalesce(p_full_name,'')),120); v_specialty text:=nullif(left(trim(coalesce(p_specialty,'')),100),''); v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 if v_name='' then raise exception 'Doctor name is required' using errcode='22023'; end if;
 perform 1 from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select * into v_doctor from public.doctors where id=p_doctor_id and clinic_id=p_clinic_id for update;
 if not found then raise exception 'Doctor not found in this clinic' using errcode='P0002'; end if;
 if p_is_active and not v_doctor.is_active then select count(*)::integer into v_count from public.doctors where clinic_id=p_clinic_id and is_active; perform private.enforce_clinic_usage_limit(p_clinic_id,'doctors',v_count); end if;
 if not p_is_active and exists(select 1 from public.queues q join public.queue_tokens t on t.id=q.current_token_id where q.clinic_id=p_clinic_id and q.doctor_id=p_doctor_id and q.status='open' and t.status in ('called','in_consultation')) then raise exception 'Resolve the current patient before deactivating this doctor' using errcode='55000'; end if;
 update public.doctors set full_name=v_name,specialty=v_specialty,is_active=p_is_active,is_public=p_is_active,updated_at=now() where id=p_doctor_id;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata) values(p_clinic_id,auth.uid(),'clinic.doctor_updated','doctor',p_doctor_id,jsonb_build_object('before',jsonb_build_object('full_name',v_doctor.full_name,'specialty',v_doctor.specialty,'is_active',v_doctor.is_active),'after',jsonb_build_object('full_name',v_name,'specialty',v_specialty,'is_active',p_is_active)));
end; $$;
