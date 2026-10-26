-- Audit history is written by trusted server-side operations only. Ordinary clinic users may read
-- records allowed by RLS but cannot forge, modify, or delete administrative history.
drop policy if exists audit_staff_insert on public.audit_logs;
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
