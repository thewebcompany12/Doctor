drop policy if exists settings_admin_read on public.clinic_settings;
create policy settings_admin_read on public.clinic_settings for select to authenticated using (private.is_platform_admin());
