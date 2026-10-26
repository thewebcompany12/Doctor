-- Public projection deliberately excludes patient names, phone hashes, tracking secrets and appointments.
-- Keep this view as the only anonymous queue data surface.
create or replace view public.public_queue_status as
select q.id as queue_id, c.clinic_code, c.slug as clinic_slug, c.name as clinic_name,
       d.full_name as doctor_name, d.specialty, q.service_date, q.status as queue_status,
       q.token_prefix, q.online_booking_enabled, q.walk_in_enabled, q.max_tokens,
       q.average_consultation_minutes,
       (select t.display_token from public.queue_tokens t
        where t.id=q.current_token_id and t.queue_id=q.id
          and t.status in ('called','in_consultation')) as current_display_token,
       (select count(*)::integer from public.queue_tokens t
        where t.queue_id=q.id and t.service_date=q.service_date and t.status='waiting') as waiting_count,
       (select count(*)::integer from public.queue_tokens t
        where t.queue_id=q.id and t.service_date=q.service_date and t.status='completed') as completed_count,
       q.updated_at
from public.queues q
join public.clinics c on c.id=q.clinic_id
join public.doctors d on d.id=q.doctor_id and d.clinic_id=q.clinic_id
where c.is_active and c.is_public and d.is_active and d.is_public;
