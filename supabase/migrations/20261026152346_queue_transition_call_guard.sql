create or replace function public.transition_queue_token(
  p_token_id uuid, p_action text, p_reason text default null, p_idempotency_key text default null
)
returns table(token_id uuid, display_token text, token_status text)
language plpgsql security definer set search_path = public
as $$
declare
  v_token public.queue_tokens%rowtype;
  v_queue public.queues%rowtype;
  v_previous text;
  v_next text;
  v_event text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_token from public.queue_tokens where id = p_token_id for update;
  if not found then raise exception 'Token not found' using errcode = 'P0002'; end if;
  select * into v_queue from public.queues where id = v_token.queue_id for update;
  if not public.has_clinic_role(v_token.clinic_id, array['owner','manager','doctor','receptionist','compounder']) then
    raise exception 'Not authorized for this clinic' using errcode = '42501';
  end if;
  if p_idempotency_key is not null and exists (
    select 1 from public.queue_events e where e.clinic_id = v_token.clinic_id
      and e.idempotency_key = 'transition:' || p_idempotency_key
  ) then return query select v_token.id, v_token.display_token, v_token.status; return; end if;

  v_previous := v_token.status;
  case p_action
    when 'call' then
      if v_token.status <> 'called' or v_queue.current_token_id <> v_token.id or v_queue.status <> 'open' then raise exception 'Only the current called patient can be recalled' using errcode = '55000'; end if;
      v_next := 'called'; v_event := 'token_recalled';
    when 'start' then
      if v_token.status <> 'called' then raise exception 'Only called tokens can start consultation' using errcode = '55000'; end if;
      v_next := 'in_consultation'; v_event := 'consultation_started';
    when 'complete' then
      if v_token.status <> 'in_consultation' then raise exception 'Only tokens in consultation can be completed' using errcode = '55000'; end if;
      v_next := 'completed'; v_event := 'consultation_completed';
    when 'skip' then
      if v_token.status not in ('waiting','called') then raise exception 'Token cannot be skipped in the current state' using errcode = '55000'; end if;
      if nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'A skip reason is required' using errcode = '22023'; end if;
      v_next := 'skipped'; v_event := 'token_skipped';
    when 'absent' then
      if v_token.status not in ('waiting','called') then raise exception 'Token cannot be marked absent in the current state' using errcode = '55000'; end if;
      v_next := 'absent'; v_event := 'token_absent';
    when 'cancel' then
      if v_token.status not in ('waiting','called') then raise exception 'Token cannot be cancelled in the current state' using errcode = '55000'; end if;
      v_next := 'cancelled'; v_event := 'token_cancelled';
    else raise exception 'Unsupported queue action' using errcode = '22023';
  end case;

  update public.queue_tokens set status = v_next, updated_at = now(),
    called_at = case when v_next = 'called' then coalesce(called_at, now()) else called_at end,
    completed_at = case when v_next = 'completed' then now() else completed_at end
    where id = v_token.id returning * into v_token;

  if v_next in ('called','in_consultation') then
    update public.queues set current_token_id = v_token.id, updated_at = now() where id = v_queue.id;
  elsif v_queue.current_token_id = v_token.id then
    update public.queues set current_token_id = null, updated_at = now() where id = v_queue.id;
  end if;

  insert into public.queue_events (clinic_id, queue_id, token_id, actor_user_id, event_type,
    previous_status, new_status, reason, idempotency_key)
  values (v_token.clinic_id, v_token.queue_id, v_token.id, auth.uid(), v_event,
    v_previous, v_next, nullif(trim(coalesce(p_reason,'')), ''),
    case when p_idempotency_key is null then null else 'transition:' || p_idempotency_key end)
  on conflict (clinic_id, idempotency_key) do nothing;

  return query select v_token.id, v_token.display_token, v_token.status;
end;
$$;

revoke all on function public.issue_staff_token(uuid,text,text) from public, anon;
grant execute on function public.issue_staff_token(uuid,text,text) to authenticated;
revoke all on function public.transition_queue_token(uuid,text,text,text) from public, anon;
grant execute on function public.transition_queue_token(uuid,text,text,text) to authenticated;
