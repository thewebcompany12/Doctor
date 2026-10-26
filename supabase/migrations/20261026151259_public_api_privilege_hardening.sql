-- Minimize anonymous API access. Public traffic may read only the explicitly curated queue view.
revoke all privileges on all tables in schema public from anon;
grant select on public.public_queue_status to anon;
revoke all on function public.has_clinic_role(uuid, text[]) from public, anon;
grant execute on function public.has_clinic_role(uuid, text[]) to authenticated;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
revoke all on function public.issue_staff_token(uuid, text, text) from public, anon;
grant execute on function public.issue_staff_token(uuid, text, text) to authenticated;
revoke all on function public.transition_queue_token(uuid, text, text, text) from public, anon;
grant execute on function public.transition_queue_token(uuid, text, text, text) to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;