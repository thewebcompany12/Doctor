create or replace function public.issue_staff_token(p_queue_id uuid,p_patient_label text default 'Patient',p_idempotency_key text default null)
returns table(token_id uuid,token_number integer,display_token text,token_status text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_queue public.queues%rowtype; v_token public.queue_tokens%rowtype; v_label text; v_queue_count integer; v_clinic_count integer; v_plan_limit integer; v_effective_limit integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update; if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if v_queue.status<>'open' then raise exception 'Queue is not open' using errcode='55000'; end if;
 if not v_queue.walk_in_enabled then raise exception 'Walk-in tokens are disabled' using errcode='55000'; end if;
 if p_idempotency_key is not null then select * into v_token from public.queue_tokens where queue_id=v_queue.id and idempotency_key=p_idempotency_key; if found then return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status; return; end if; end if;
 select count(*)::integer into v_queue_count from public.queue_tokens where queue_id=v_queue.id and service_date=v_queue.service_date;
 select count(*)::integer into v_clinic_count from public.queue_tokens where clinic_id=v_queue.clinic_id and service_date=v_queue.service_date;
 select nullif(settings #>> '{subscription,limits,dailyTokens}','')::integer into v_plan_limit from public.clinic_settings where clinic_id=v_queue.clinic_id;
 if v_queue.max_tokens is null then v_effective_limit:=v_plan_limit; elsif v_plan_limit is null then v_effective_limit:=v_queue.max_tokens; else v_effective_limit:=least(v_queue.max_tokens,v_plan_limit); end if;
 if v_effective_limit is not null and v_queue_count>=v_effective_limit then raise exception 'Daily token limit reached' using errcode='55000'; end if;
 v_label:=left(regexp_replace(coalesce(nullif(trim(p_patient_label),''),'Patient'),'[[:cntrl:]]','','g'),80);
 insert into public.queue_tokens(clinic_id,queue_id,service_date,token_number,display_token,patient_label,status,booking_source,idempotency_key) values(v_queue.clinic_id,v_queue.id,v_queue.service_date,v_queue.next_token_number,left(v_queue.token_prefix,8)||v_queue.next_token_number::text,v_label,'waiting','walk_in',p_idempotency_key) returning * into v_token;
 update public.queues set next_token_number=next_token_number+1,updated_at=now() where id=v_queue.id;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,new_status,idempotency_key) values(v_queue.clinic_id,v_queue.id,v_token.id,auth.uid(),'token_issued','waiting',case when p_idempotency_key is null then null else 'issue:'||p_idempotency_key end) on conflict(clinic_id,idempotency_key) do nothing;
 return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status;
end; $$;
revoke all on function public.issue_staff_token(uuid,text,text) from public,anon;
grant execute on function public.issue_staff_token(uuid,text,text) to authenticated;
