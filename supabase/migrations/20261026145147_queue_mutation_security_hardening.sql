-- Applied to the connected Supabase project as queue_mutation_security_hardening.
-- Only SECURITY DEFINER queue functions may allocate tokens or transition token state.
revoke insert, update, delete on public.queue_tokens from authenticated;
grant select on public.queue_tokens to authenticated;
revoke insert, update, delete on public.queue_events from authenticated;
grant select on public.queue_events to authenticated;
revoke insert, update, delete on public.queues from authenticated;
grant select on public.queues to authenticated;

-- Profile users may edit only non-privileged profile columns.
revoke update on public.profiles from authenticated;
grant update (display_name, preferred_language, updated_at) on public.profiles to authenticated;
