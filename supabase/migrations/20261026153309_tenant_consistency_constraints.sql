alter table public.queues
  add constraint queues_clinic_id_id_key unique (clinic_id,id);
alter table public.queue_tokens
  add constraint queue_tokens_clinic_id_id_key unique (clinic_id,id);
alter table public.queue_tokens
  add constraint queue_tokens_queue_id_id_key unique (queue_id,id);
alter table public.queue_tokens
  add constraint queue_tokens_clinic_queue_fkey
  foreign key (clinic_id,queue_id) references public.queues(clinic_id,id) on delete cascade;
alter table public.queue_events
  add constraint queue_events_clinic_queue_fkey
  foreign key (clinic_id,queue_id) references public.queues(clinic_id,id) on delete cascade;
