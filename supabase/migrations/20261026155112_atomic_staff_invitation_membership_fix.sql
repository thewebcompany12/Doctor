create or replace function private.attach_invited_staff(p_clinic_id uuid,p_user_id uuid,p_role text,p_email text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor_role text; v_clinic public.clinics%rowtype; v_existing public.clinic_memberships%rowtype; v_count integer; v_membership_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select role into v_actor_role from public.clinic_memberships where clinic_id=p_clinic_id and user_id=auth.uid() and is_active;
 if v_actor_role is null or v_actor_role not in ('owner','manager') then raise exception 'Clinic owner or manager permission required' using errcode='42501'; end if;
 if p_role not in ('manager','doctor','receptionist','compounder') then raise exception 'Unsupported staff role' using errcode='22023'; end if;
 if v_actor_role='manager' and p_role='manager' then raise exception 'Only the clinic owner can invite another manager' using errcode='42501'; end if;
 select * into v_clinic from public.clinics where id=p_clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select * into v_existing from public.clinic_memberships where clinic_id=p_clinic_id and user_id=p_user_id for update;
 if found and v_existing.is_active then raise exception 'This user is already active in the clinic' using errcode='23505'; end if;
 select count(*)::integer into v_count from public.clinic_memberships where clinic_id=p_clinic_id and is_active;
 perform private.enforce_clinic_usage_limit(p_clinic_id,'staff',v_count);
 if v_existing.id is not null then update public.clinic_memberships set role=p_role,is_active=true where id=v_existing.id returning id into v_membership_id;
 else insert into public.clinic_memberships(clinic_id,user_id,role,is_active) values(p_clinic_id,p_user_id,p_role,true) returning id into v_membership_id; end if;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata)
 values(p_clinic_id,auth.uid(),'clinic.staff_invited','clinic_membership',v_membership_id,jsonb_build_object('email',p_email,'role',p_role,'user_id',p_user_id));
 return v_membership_id;
end; $$;
