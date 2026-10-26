create or replace function private.enforce_clinic_usage_limit(p_clinic_id uuid,p_resource text,p_current_count integer)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_limit integer; v_settings jsonb;
begin
 select settings into v_settings from public.clinic_settings where clinic_id=p_clinic_id;
 if v_settings is null or v_settings->'subscription' is null then return; end if;
 v_limit:=case p_resource when 'doctors' then nullif(v_settings #>> '{subscription,limits,doctors}','')::integer when 'branches' then nullif(v_settings #>> '{subscription,limits,branches}','')::integer when 'staff' then nullif(v_settings #>> '{subscription,limits,staff}','')::integer when 'dailyTokens' then nullif(v_settings #>> '{subscription,limits,dailyTokens}','')::integer else null end;
 if v_limit is not null and p_current_count>=v_limit then raise exception 'Clinic % usage limit reached (% max)',p_resource,v_limit using errcode='55000'; end if;
end; $$;
revoke all on function private.enforce_clinic_usage_limit(uuid,text,integer) from public,anon,authenticated;
create or replace function public.issue_staff_token(p_queue_id uuid,p_patient_label text default 'Patient',p_idempotency_key text default null)
returns table(token_id uuid,token_number integer,display_token text,token_status text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_queue public.queues%rowtype; v_token public.queue_tokens%rowtype; v_label text; v_queue_count integer; v_clinic_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_queue from public.queues where id=p_queue_id;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 perform 1 from public.clinics where id=v_queue.clinic_id and is_active for update;
 if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if v_queue.status<>'open' then raise exception 'Queue is not open' using errcode='55000'; end if;
 if not v_queue.walk_in_enabled then raise exception 'Walk-in tokens are disabled' using errcode='55000'; end if;
 if p_idempotency_key is not null then
  select * into v_token from public.queue_tokens where queue_id=v_queue.id and idempotency_key=p_idempotency_key;
  if found then return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status; return; end if;
 end if;
 select count(*)::integer into v_queue_count from public.queue_tokens where queue_id=v_queue.id and service_date=v_queue.service_date;
 if v_queue.max_tokens is not null and v_queue_count>=v_queue.max_tokens then raise exception 'Queue daily token limit reached' using errcode='55000'; end if;
 select count(*)::integer into v_clinic_count from public.queue_tokens where clinic_id=v_queue.clinic_id and service_date=v_queue.service_date;
 perform private.enforce_clinic_usage_limit(v_queue.clinic_id,'dailyTokens',v_clinic_count);
 v_label:=left(regexp_replace(coalesce(nullif(trim(p_patient_label),''),'Patient'),'[[:cntrl:]]','','g'),80);
 insert into public.queue_tokens(clinic_id,queue_id,service_date,token_number,display_token,patient_label,status,booking_source,idempotency_key)
 values(v_queue.clinic_id,v_queue.id,v_queue.service_date,v_queue.next_token_number,left(v_queue.token_prefix,8)||v_queue.next_token_number::text,v_label,'waiting','walk_in',p_idempotency_key)
 returning * into v_token;
 update public.queues set next_token_number=next_token_number+1,updated_at=now() where id=v_queue.id;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,new_status,idempotency_key)
 values(v_queue.clinic_id,v_queue.id,v_token.id,auth.uid(),'token_issued','waiting',case when p_idempotency_key is null then null else 'issue:'||p_idempotency_key end)
 on conflict(clinic_id,idempotency_key) do nothing;
 return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status;
end; $$;
revoke all on function public.issue_staff_token(uuid,text,text) from public,anon;
grant execute on function public.issue_staff_token(uuid,text,text) to authenticated;
create or replace function public.create_clinic_queue(p_clinic_id uuid,p_doctor_name text,p_specialty text default null,p_token_prefix text default 'T',p_max_tokens integer default null,p_online_booking_enabled boolean default false,p_walk_in_enabled boolean default true)
returns table(queue_id uuid,doctor_id uuid,service_date date)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_clinic public.clinics%rowtype; v_doctor public.doctors%rowtype; v_queue public.queues%rowtype; v_date date:=(timezone('Asia/Kolkata',now()))::date; v_name text:=left(trim(coalesce(p_doctor_name,'')),120); v_prefix text:=left(trim(coalesce(p_token_prefix,'T')),8); v_settings jsonb; v_online_allowed boolean; v_walkin_allowed boolean; v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if v_name='' then raise exception 'Doctor name is required' using errcode='22023'; end if;
 if v_prefix='' then raise exception 'Token prefix is required' using errcode='22023'; end if;
 if p_max_tokens is not null and p_max_tokens<1 then raise exception 'Daily token limit must be positive' using errcode='22023'; end if;
 select * into v_clinic from public.clinics where id=p_clinic_id for update;
 if not found or not v_clinic.is_active then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 select settings into v_settings from public.clinic_settings where clinic_id=p_clinic_id;
 v_online_allowed:=coalesce((v_settings #>> '{subscription,booking,online}')::boolean,true); v_walkin_allowed:=coalesce((v_settings #>> '{subscription,booking,walkIn}')::boolean,true);
 if p_online_booking_enabled and not v_online_allowed then raise exception 'Online booking is disabled by the clinic plan' using errcode='55000'; end if;
 if p_walk_in_enabled and not v_walkin_allowed then raise exception 'Walk-in booking is disabled by the clinic plan' using errcode='55000'; end if;
 select * into v_doctor from public.doctors d where d.clinic_id=p_clinic_id and lower(d.full_name)=lower(v_name) and d.is_active order by d.created_at limit 1;
 if not found then select count(*)::integer into v_count from public.doctors where clinic_id=p_clinic_id and is_active; perform private.enforce_clinic_usage_limit(p_clinic_id,'doctors',v_count);
 insert into public.doctors(clinic_id,full_name,specialty,is_active,is_public) values(p_clinic_id,v_name,nullif(trim(coalesce(p_specialty,'')),''),true,true) returning * into v_doctor; end if;
 select * into v_queue from public.queues q where q.clinic_id=p_clinic_id and q.doctor_id=v_doctor.id and q.service_date=v_date for update;
 if found then update public.queues set token_prefix=v_prefix,max_tokens=p_max_tokens,online_booking_enabled=p_online_booking_enabled,walk_in_enabled=p_walk_in_enabled,updated_at=now() where id=v_queue.id returning * into v_queue;
 else insert into public.queues(clinic_id,doctor_id,service_date,token_prefix,max_tokens,online_booking_enabled,walk_in_enabled) values(p_clinic_id,v_doctor.id,v_date,v_prefix,p_max_tokens,p_online_booking_enabled,p_walk_in_enabled) returning * into v_queue; end if;
 return query select v_queue.id,v_doctor.id,v_date;
end; $$;
revoke all on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) from public,anon;
grant execute on function public.create_clinic_queue(uuid,text,text,text,integer,boolean,boolean) to authenticated;
create or replace function private.create_clinic_branch(p_clinic_id uuid,p_branch_code text,p_name text,p_address text default null,p_city text default null,p_state text default null,p_postal_code text default null,p_phone text default null)
returns table(branch_id uuid,branch_code text,branch_name text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_branch public.clinic_branches%rowtype; v_code text:=upper(trim(coalesce(p_branch_code,''))); v_name text:=trim(coalesce(p_name,'')); v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_clinic_role(p_clinic_id,array['owner','manager']) then raise exception 'Owner or manager permission required' using errcode='42501'; end if;
 if v_code !~ '^[A-Z0-9-]{2,16}$' then raise exception 'Branch code must be 2–16 letters, numbers or hyphens' using errcode='22023'; end if;
 if v_name='' or length(v_name)>120 then raise exception 'Valid branch name is required' using errcode='22023'; end if;
 perform 1 from public.clinics where id=p_clinic_id and is_active for update; if not found then raise exception 'Active clinic not found' using errcode='P0002'; end if;
 select count(*)::integer into v_count from public.clinic_branches where clinic_id=p_clinic_id and is_active; perform private.enforce_clinic_usage_limit(p_clinic_id,'branches',v_count);
 insert into public.clinic_branches(clinic_id,branch_code,name,address,city,state,postal_code,phone) values(p_clinic_id,v_code,v_name,nullif(trim(coalesce(p_address,'')),''),nullif(trim(coalesce(p_city,'')),''),nullif(trim(coalesce(p_state,'')),''),nullif(trim(coalesce(p_postal_code,'')),''),nullif(trim(coalesce(p_phone,'')),''))
 returning * into v_branch;
 insert into public.audit_logs(clinic_id,actor_user_id,action,target_type,target_id,metadata) values(p_clinic_id,auth.uid(),'clinic.branch_created','branch',v_branch.id,jsonb_build_object('branch_code',v_code,'name',v_name));
 return query select v_branch.id,v_branch.branch_code,v_branch.name;
end; $$;
