drop function if exists public.issue_public_queue_token(uuid,text,text);
drop function if exists private.issue_public_queue_token_impl(uuid,text,text);

create or replace function private.issue_public_queue_token_impl(
 p_queue_id uuid,p_patient_label text,p_rate_limit_key_hash text,p_idempotency_key text
) returns table(token_id uuid,token_number integer,display_token text,tracking_secret text,tracking_expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare
 v_clinic_id uuid; v_clinic public.clinics%rowtype; v_queue public.queues%rowtype; v_existing public.queue_tokens%rowtype;
 v_hours public.clinic_hours%rowtype; v_local_now timestamp without time zone;
 v_settings jsonb; v_online_allowed boolean; v_rate_count integer; v_queue_count integer; v_clinic_count integer;
 v_plan_limit integer; v_effective_limit integer; v_label text; v_secret text; v_secret_hash text; v_token public.queue_tokens%rowtype;
begin
 if p_queue_id is null then raise exception 'Queue is required' using errcode='22023'; end if;
 if p_rate_limit_key_hash is null or p_rate_limit_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid booking request' using errcode='22023'; end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'A valid idempotency key is required' using errcode='22023'; end if;
 v_label:=left(regexp_replace(coalesce(nullif(trim(p_patient_label),''),'Patient'),'[[:cntrl:]]','','g'),80);
 insert into private.public_booking_rate_limits(rate_key_hash,window_started_at,request_count,updated_at)
 values(p_rate_limit_key_hash,now(),1,now())
 on conflict(rate_key_hash) do update set
  request_count=case when private.public_booking_rate_limits.window_started_at<now()-interval '15 minutes' then 1 else private.public_booking_rate_limits.request_count+1 end,
  window_started_at=case when private.public_booking_rate_limits.window_started_at<now()-interval '15 minutes' then now() else private.public_booking_rate_limits.window_started_at end,
  updated_at=now()
 returning request_count into v_rate_count;
 if v_rate_count>8 then raise exception 'Booking rate limit reached. Try again in 15 minutes.' using errcode='54000'; end if;
 if v_rate_count=1 then delete from private.public_booking_rate_limits where updated_at<now()-interval '2 days' and rate_key_hash<>p_rate_limit_key_hash; end if;

 select clinic_id into v_clinic_id from public.queues where id=p_queue_id;
 if not found then raise exception 'Public queue not found' using errcode='P0002'; end if;
 select * into v_clinic from public.clinics where id=v_clinic_id and is_active and is_public for update;
 if not found then raise exception 'Public queue not found' using errcode='P0002'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update;
 if not found or v_queue.clinic_id<>v_clinic.id then raise exception 'Public queue not found' using errcode='P0002'; end if;

 select * into v_existing from public.queue_tokens t where t.queue_id=v_queue.id and t.idempotency_key=p_idempotency_key for update;
 if found then
  if v_existing.tracking_expires_at is null or v_existing.tracking_expires_at<=now() then raise exception 'This booking request has expired; start a new booking' using errcode='55000'; end if;
  v_secret:=encode(extensions.gen_random_bytes(32),'hex');
  v_secret_hash:=encode(extensions.digest(convert_to(v_secret,'UTF8'),'sha256'),'hex');
  update public.queue_tokens set tracking_secret_hash=v_secret_hash,tracking_expires_at=now()+interval '48 hours',tracking_revoked_at=null,updated_at=now()
   where id=v_existing.id returning * into v_token;
  return query select v_token.id,v_token.token_number,v_token.display_token,v_secret,v_token.tracking_expires_at;
  return;
 end if;

 if v_queue.service_date<>(timezone(coalesce(v_clinic.timezone,'Asia/Kolkata'),now()))::date then raise exception 'This queue is not available for online booking today' using errcode='55000'; end if;
 if v_queue.status<>'open' or not v_queue.online_booking_enabled then raise exception 'Online booking is disabled for this queue' using errcode='55000'; end if;
 if not exists(select 1 from public.doctors d where d.id=v_queue.doctor_id and d.clinic_id=v_clinic.id and d.is_active and d.is_public) then raise exception 'Public queue not found' using errcode='P0002'; end if;

 v_local_now:=timezone(coalesce(v_clinic.timezone,'Asia/Kolkata'),now());
 select * into v_hours from public.clinic_hours h
 where h.clinic_id=v_clinic.id and h.weekday=extract(dow from v_local_now::date)::integer
   and (h.doctor_id=v_queue.doctor_id or h.doctor_id is null)
 order by (h.doctor_id is not null) desc,h.created_at desc limit 1;
 if not found or v_hours.is_closed or v_hours.opens_at is null or v_hours.closes_at is null
    or v_local_now::time<v_hours.opens_at or v_local_now::time>=v_hours.closes_at then
  raise exception 'Online booking is outside configured clinic hours' using errcode='55000';
 end if;

 select settings into v_settings from public.clinic_settings where clinic_id=v_clinic.id;
 v_online_allowed:=coalesce((v_settings #>> '{subscription,booking,online}')::boolean,false);
 if not v_online_allowed then raise exception 'Online booking is disabled by the clinic plan' using errcode='55000'; end if;
 select count(*)::integer into v_queue_count from public.queue_tokens t where t.queue_id=v_queue.id and t.service_date=v_queue.service_date;
 select count(*)::integer into v_clinic_count from public.queue_tokens t where t.clinic_id=v_clinic.id and t.service_date=v_queue.service_date;
 select nullif(v_settings #>> '{subscription,limits,dailyTokens}','')::integer into v_plan_limit;
 if v_queue.max_tokens is null then v_effective_limit:=v_plan_limit;
 elsif v_plan_limit is null then v_effective_limit:=v_queue.max_tokens;
 else v_effective_limit:=least(v_queue.max_tokens,v_plan_limit);
 end if;
 if v_effective_limit is not null and v_queue_count>=v_effective_limit then raise exception 'Daily token limit reached' using errcode='55000'; end if;
 perform private.enforce_clinic_usage_limit(v_clinic.id,'dailyTokens',v_clinic_count);
 v_secret:=encode(extensions.gen_random_bytes(32),'hex');
 v_secret_hash:=encode(extensions.digest(convert_to(v_secret,'UTF8'),'sha256'),'hex');
 insert into public.queue_tokens(clinic_id,queue_id,service_date,token_number,display_token,patient_label,status,booking_source,idempotency_key,tracking_secret_hash,tracking_expires_at)
 values(v_clinic.id,v_queue.id,v_queue.service_date,v_queue.next_token_number,left(v_queue.token_prefix,8)||v_queue.next_token_number::text,v_label,'waiting','online',p_idempotency_key,v_secret_hash,now()+interval '48 hours')
 returning * into v_token;
 update public.queues set next_token_number=next_token_number+1,updated_at=now() where id=v_queue.id;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,new_status,metadata)
 values(v_clinic.id,v_queue.id,v_token.id,null,'online_token_issued','waiting',jsonb_build_object('booking_source','online'));
 return query select v_token.id,v_token.token_number,v_token.display_token,v_secret,v_token.tracking_expires_at;
end;
$$;
revoke all on function private.issue_public_queue_token_impl(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.issue_public_queue_token_impl(uuid,text,text,text) to service_role;

create or replace function public.issue_public_queue_token(p_queue_id uuid,p_patient_label text,p_rate_limit_key_hash text,p_idempotency_key text)
returns table(token_id uuid,token_number integer,display_token text,tracking_secret text,tracking_expires_at timestamptz)
language sql security invoker set search_path=pg_catalog,public,private,extensions
as $$ select * from private.issue_public_queue_token_impl($1,$2,$3,$4); $$;
revoke all on function public.issue_public_queue_token(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.issue_public_queue_token(uuid,text,text,text) to service_role;
