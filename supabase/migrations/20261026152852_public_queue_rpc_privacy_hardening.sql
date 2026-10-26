create or replace function public.get_public_queue_status()
returns table(
  queue_id uuid, clinic_code text, clinic_slug text, clinic_name text, doctor_name text, specialty text,
  service_date date, queue_status text, token_prefix text, online_booking_enabled boolean, walk_in_enabled boolean,
  max_tokens integer, average_consultation_minutes integer, current_display_token text,
  waiting_count integer, completed_count integer, updated_at timestamptz
)
language sql stable security definer set search_path=public set row_security=off
as $$
  select q.id,c.clinic_code,c.slug,c.name,d.full_name,d.specialty,q.service_date,q.status,q.token_prefix,
    q.online_booking_enabled,q.walk_in_enabled,q.max_tokens,q.average_consultation_minutes,
    (select t.display_token from public.queue_tokens t where t.id=q.current_token_id and t.queue_id=q.id and t.status in ('called','in_consultation')),
    (select count(*)::integer from public.queue_tokens t where t.queue_id=q.id and t.service_date=q.service_date and t.status='waiting'),
    (select count(*)::integer from public.queue_tokens t where t.queue_id=q.id and t.service_date=q.service_date and t.status='completed'),
    q.updated_at
  from public.queues q
  join public.clinics c on c.id=q.clinic_id
  join public.doctors d on d.id=q.doctor_id and d.clinic_id=q.clinic_id
  where c.is_active and c.is_public and d.is_active and d.is_public;
$$;
revoke all on function public.get_public_queue_status() from public,authenticated,anon;
grant execute on function public.get_public_queue_status() to anon;
revoke all privileges on public.public_queue_status from anon,authenticated;
drop view if exists public.public_queue_status;
