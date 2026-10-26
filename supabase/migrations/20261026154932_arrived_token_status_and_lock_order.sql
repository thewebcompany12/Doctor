alter table public.queue_tokens drop constraint if exists queue_tokens_status_check;
alter table public.queue_tokens add constraint queue_tokens_status_check
check (status = any (array['waiting','arrived','called','in_consultation','completed','skipped','absent','cancelled']));

create or replace function public.transition_queue_token(p_token_id uuid,p_action text,p_reason text default null,p_idempotency_key text default null)
returns table(token_id uuid,display_token text,token_status text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_token public.queue_tokens%rowtype; v_queue public.queues%rowtype; v_previous text; v_next text; v_event text; v_queue_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select queue_id into v_queue_id from public.queue_tokens where id=p_token_id;
 if not found then raise exception 'Token not found' using errcode='P0002'; end if;
 select * into v_queue from public.queues where id=v_queue_id for update;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 select * into v_token from public.queue_tokens where id=p_token_id and queue_id=v_queue.id for update;
 if not found then raise exception 'Token not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_token.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if p_idempotency_key is not null and exists(select 1 from public.queue_events e where e.clinic_id=v_token.clinic_id and e.idempotency_key='transition:'||p_idempotency_key) then return query select v_token.id,v_token.display_token,v_token.status; return; end if;
 v_previous:=v_token.status;
 case p_action
  when 'arrive' then if v_token.status<>'waiting' or v_queue.status='closed' then raise exception 'Only waiting tokens can be marked arrived' using errcode='55000'; end if; v_next:='arrived'; v_event:='patient_arrived';
  when 'call' then if v_token.status<>'called' or v_queue.current_token_id<>v_token.id or v_queue.status<>'open' then raise exception 'Only the current called patient can be recalled' using errcode='55000'; end if; v_next:='called'; v_event:='token_recalled';
  when 'start' then if v_token.status<>'called' or v_queue.current_token_id<>v_token.id then raise exception 'Only the current called patient can start consultation' using errcode='55000'; end if; v_next:='in_consultation'; v_event:='consultation_started';
  when 'complete' then if v_token.status<>'in_consultation' or v_queue.current_token_id<>v_token.id then raise exception 'Only the current consultation can be completed' using errcode='55000'; end if; v_next:='completed'; v_event:='consultation_completed';
  when 'skip' then if v_token.status not in ('waiting','arrived','called') then raise exception 'Token cannot be skipped in the current state' using errcode='55000'; end if; if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A skip reason is required' using errcode='22023'; end if; v_next:='skipped'; v_event:='token_skipped';
  when 'absent' then if v_token.status not in ('waiting','arrived','called') then raise exception 'Token cannot be marked absent in the current state' using errcode='55000'; end if; v_next:='absent'; v_event:='token_absent';
  when 'cancel' then if v_token.status not in ('waiting','arrived','called') then raise exception 'Token cannot be cancelled in the current state' using errcode='55000'; end if; v_next:='cancelled'; v_event:='token_cancelled';
  else raise exception 'Unsupported queue action' using errcode='22023';
 end case;
 update public.queue_tokens set status=v_next,updated_at=now(),called_at=case when v_next='called' then coalesce(called_at,now()) else called_at end,completed_at=case when v_next='completed' then now() else completed_at end where id=v_token.id returning * into v_token;
 if v_next in ('called','in_consultation') then update public.queues set current_token_id=v_token.id,updated_at=now() where id=v_queue.id;
 elsif v_queue.current_token_id=v_token.id then update public.queues set current_token_id=null,updated_at=now() where id=v_queue.id; end if;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,previous_status,new_status,reason,idempotency_key)
 values(v_token.clinic_id,v_token.queue_id,v_token.id,auth.uid(),v_event,v_previous,v_next,nullif(trim(coalesce(p_reason,'')),''),case when p_idempotency_key is null then null else 'transition:'||p_idempotency_key end)
 on conflict(clinic_id,idempotency_key) do nothing;
 return query select v_token.id,v_token.display_token,v_token.status;
end; $$;
revoke all on function public.transition_queue_token(uuid,text,text,text) from public,anon;
grant execute on function public.transition_queue_token(uuid,text,text,text) to authenticated;

create or replace function public.advance_queue(p_queue_id uuid,p_idempotency_key text default null)
returns table(token_id uuid,token_number integer,display_token text,token_status text)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_queue public.queues%rowtype; v_token public.queue_tokens%rowtype; v_previous text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 if not private.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if v_queue.status<>'open' then raise exception 'Queue is not open' using errcode='55000'; end if;
 if p_idempotency_key is not null then select t.* into v_token from public.queue_events e join public.queue_tokens t on t.id=e.token_id where e.clinic_id=v_queue.clinic_id and e.queue_id=v_queue.id and e.idempotency_key='advance:'||p_idempotency_key; if found then return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status; return; end if; end if;
 if v_queue.current_token_id is not null and exists(select 1 from public.queue_tokens t where t.id=v_queue.current_token_id and t.status in ('called','in_consultation')) then raise exception 'Resolve the current patient before advancing' using errcode='55000'; end if;
 select * into v_token from public.queue_tokens where queue_id=v_queue.id and service_date=v_queue.service_date and status in ('waiting','arrived') order by token_number limit 1 for update skip locked;
 if not found then return; end if;
 v_previous:=v_token.status;
 update public.queue_tokens set status='called',called_at=coalesce(called_at,now()),updated_at=now() where id=v_token.id returning * into v_token;
 update public.queues set current_token_id=v_token.id,updated_at=now() where id=v_queue.id;
 insert into public.queue_events(clinic_id,queue_id,token_id,actor_user_id,event_type,previous_status,new_status,idempotency_key)
 values(v_queue.clinic_id,v_queue.id,v_token.id,auth.uid(),'token_called',v_previous,'called',case when p_idempotency_key is null then null else 'advance:'||p_idempotency_key end)
 on conflict(clinic_id,idempotency_key) do nothing;
 return query select v_token.id,v_token.token_number,v_token.display_token,v_token.status;
end; $$;
revoke all on function public.advance_queue(uuid,text) from public,anon;
grant execute on function public.advance_queue(uuid,text) to authenticated;

create or replace function private.refresh_public_queue_snapshot(p_queue_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v record; v_current text; v_waiting integer; v_completed integer;
begin
 select q.id as queue_id,c.clinic_code,c.slug as clinic_slug,c.name as clinic_name,d.full_name as doctor_name,d.specialty,q.service_date,q.status as queue_status,q.token_prefix,q.online_booking_enabled,q.walk_in_enabled,q.max_tokens,q.average_consultation_minutes,q.current_token_id,q.updated_at
 into v from public.queues q join public.clinics c on c.id=q.clinic_id join public.doctors d on d.id=q.doctor_id and d.clinic_id=q.clinic_id
 where q.id=p_queue_id and c.is_active and c.is_public and d.is_active and d.is_public;
 if not found then delete from public.public_queue_snapshots where queue_id=p_queue_id; return; end if;
 select t.display_token into v_current from public.queue_tokens t where t.id=v.current_token_id and t.queue_id=v.queue_id and t.status in ('called','in_consultation');
 select count(*)::integer into v_waiting from public.queue_tokens t where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status in ('waiting','arrived');
 select count(*)::integer into v_completed from public.queue_tokens t where t.queue_id=v.queue_id and t.service_date=v.service_date and t.status='completed';
 insert into public.public_queue_snapshots(queue_id,clinic_code,clinic_slug,clinic_name,doctor_name,specialty,service_date,queue_status,token_prefix,online_booking_enabled,walk_in_enabled,max_tokens,average_consultation_minutes,current_display_token,waiting_count,completed_count,updated_at)
 values(v.queue_id,v.clinic_code,v.clinic_slug,v.clinic_name,v.doctor_name,v.specialty,v.service_date,v.queue_status,v.token_prefix,v.online_booking_enabled,v.walk_in_enabled,v.max_tokens,v.average_consultation_minutes,v_current,v_waiting,v_completed,now())
 on conflict(queue_id) do update set clinic_code=excluded.clinic_code,clinic_slug=excluded.clinic_slug,clinic_name=excluded.clinic_name,doctor_name=excluded.doctor_name,specialty=excluded.specialty,service_date=excluded.service_date,queue_status=excluded.queue_status,token_prefix=excluded.token_prefix,online_booking_enabled=excluded.online_booking_enabled,walk_in_enabled=excluded.walk_in_enabled,max_tokens=excluded.max_tokens,average_consultation_minutes=excluded.average_consultation_minutes,current_display_token=excluded.current_display_token,waiting_count=excluded.waiting_count,completed_count=excluded.completed_count,updated_at=excluded.updated_at;
end; $$;
