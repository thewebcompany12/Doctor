create or replace function public.set_queue_status(p_queue_id uuid,p_status text)
returns table(queue_id uuid,queue_status text)
language plpgsql security definer set search_path=public
as $$
declare v_queue public.queues%rowtype; v_previous text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_status not in ('open','paused','closed') then raise exception 'Unsupported queue status' using errcode='22023'; end if;
 select * into v_queue from public.queues where id=p_queue_id for update;
 if not found then raise exception 'Queue not found' using errcode='P0002'; end if;
 if not public.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor','receptionist','compounder']) then raise exception 'Not authorized for this clinic' using errcode='42501'; end if;
 if v_queue.status='closed' then raise exception 'Closed queue cannot be reopened' using errcode='55000'; end if;
 if p_status='closed' and not public.has_clinic_role(v_queue.clinic_id,array['owner','manager','doctor']) then raise exception 'Only owners, managers or doctors can close a queue' using errcode='42501'; end if;
 v_previous := v_queue.status;
 update public.queues set status=p_status,updated_at=now() where id=v_queue.id returning * into v_queue;
 insert into public.queue_events(clinic_id,queue_id,actor_user_id,event_type,previous_status,new_status)
 values(v_queue.clinic_id,v_queue.id,auth.uid(),'queue_status_changed',v_previous,p_status);
 return query select v_queue.id,v_queue.status;
end;
$$;
revoke all on function public.set_queue_status(uuid,text) from public,anon;
grant execute on function public.set_queue_status(uuid,text) to authenticated;
