-- Remove broad default Supabase table privileges that can bypass RLS (notably TRUNCATE).
revoke all privileges on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.platform_roles, public.clinics, public.clinic_memberships,
  public.doctors, public.clinic_hours, public.queues, public.queue_tokens, public.queue_events,
  public.clinic_settings, public.audit_logs, public.notification_preferences, public.notification_deliveries,
  public.clinic_branches, public.appointments, public.public_queue_snapshots to authenticated;
grant select on public.public_queue_snapshots to anon;
grant update (display_name, preferred_language, updated_at) on public.profiles to authenticated;

revoke insert, update, delete, truncate, references, trigger on public.platform_roles from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.clinics from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.clinic_memberships from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.doctors from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.clinic_hours from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.queues from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.queue_tokens from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.queue_events from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.clinic_settings from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.audit_logs from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.notification_preferences from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.notification_deliveries from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.clinic_branches from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.appointments from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.public_queue_snapshots from authenticated;
