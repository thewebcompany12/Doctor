-- Cover foreign keys reported by the Supabase performance advisor.
-- Index creation is additive and does not alter existing rows or constraints.
create index if not exists appointments_clinic_branch_fk_idx on public.appointments(clinic_id,branch_id);
create index if not exists appointments_created_by_fk_idx on public.appointments(created_by);
create index if not exists audit_logs_actor_user_fk_idx on public.audit_logs(actor_user_id);
create index if not exists clinic_hours_clinic_fk_idx on public.clinic_hours(clinic_id);
create index if not exists clinic_hours_doctor_fk_idx on public.clinic_hours(doctor_id);
create index if not exists clinics_created_by_fk_idx on public.clinics(created_by);
create index if not exists doctors_user_id_fk_idx on public.doctors(user_id);
create index if not exists queue_events_actor_user_fk_idx on public.queue_events(actor_user_id);
create index if not exists queue_events_clinic_queue_fk_idx on public.queue_events(clinic_id,queue_id);
create index if not exists queue_events_token_fk_idx on public.queue_events(token_id);
create index if not exists queue_tokens_clinic_queue_fk_idx on public.queue_tokens(clinic_id,queue_id);
create index if not exists queues_current_token_fk_idx on public.queues(current_token_id);
