-- Consolidate overlapping permissive SELECT policies without widening data access.
drop policy if exists clinic_branches_owner_manage on public.clinic_branches;
drop policy if exists clinic_branches_member_read on public.clinic_branches;
create policy clinic_branches_select on public.clinic_branches for select to authenticated
 using (private.is_platform_admin() or private.has_clinic_role(clinic_id));
create policy clinic_branches_insert on public.clinic_branches for insert to authenticated
 with check (private.is_platform_admin() or private.has_clinic_role(clinic_id,array['owner','manager']));
create policy clinic_branches_update on public.clinic_branches for update to authenticated
 using (private.is_platform_admin() or private.has_clinic_role(clinic_id,array['owner','manager']))
 with check (private.is_platform_admin() or private.has_clinic_role(clinic_id,array['owner','manager']));
create policy clinic_branches_delete on public.clinic_branches for delete to authenticated
 using (private.is_platform_admin() or private.has_clinic_role(clinic_id,array['owner','manager']));
drop policy if exists clinic_hours_manage on public.clinic_hours;
drop policy if exists clinic_hours_public_read on public.clinic_hours;
create policy clinic_hours_select on public.clinic_hours for select to authenticated
 using (exists(select 1 from public.clinics c where c.id=clinic_hours.clinic_id and c.is_active and c.is_public) or private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy clinic_hours_insert on public.clinic_hours for insert to authenticated with check (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy clinic_hours_update on public.clinic_hours for update to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager','doctor'])) with check (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy clinic_hours_delete on public.clinic_hours for delete to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
drop policy if exists memberships_owner_manage on public.clinic_memberships;
drop policy if exists memberships_member_or_admin_read on public.clinic_memberships;
create policy memberships_select on public.clinic_memberships for select to authenticated using (user_id=(select auth.uid()) or private.has_clinic_role(clinic_id,array['owner','manager']) or private.is_platform_admin());
create policy memberships_insert on public.clinic_memberships for insert to authenticated with check (private.has_clinic_role(clinic_id,array['owner']) or private.is_platform_admin());
create policy memberships_update on public.clinic_memberships for update to authenticated using (private.has_clinic_role(clinic_id,array['owner']) or private.is_platform_admin()) with check (private.has_clinic_role(clinic_id,array['owner']) or private.is_platform_admin());
create policy memberships_delete on public.clinic_memberships for delete to authenticated using (private.has_clinic_role(clinic_id,array['owner']) or private.is_platform_admin());
drop policy if exists settings_owner_manage on public.clinic_settings;
drop policy if exists settings_admin_read on public.clinic_settings;
drop policy if exists settings_staff_read on public.clinic_settings;
create policy settings_select on public.clinic_settings for select to authenticated using (private.is_platform_admin() or private.has_clinic_role(clinic_id));
create policy settings_insert on public.clinic_settings for insert to authenticated with check (private.has_clinic_role(clinic_id,array['owner','manager']));
create policy settings_update on public.clinic_settings for update to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager'])) with check (private.has_clinic_role(clinic_id,array['owner','manager']));
create policy settings_delete on public.clinic_settings for delete to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager']));
drop policy if exists clinics_admin_manage on public.clinics;
drop policy if exists clinics_public_read on public.clinics;
create policy clinics_select on public.clinics for select to authenticated using (private.is_platform_admin() or (is_active and is_public));
create policy clinics_insert on public.clinics for insert to authenticated with check (private.is_platform_admin());
create policy clinics_update on public.clinics for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy clinics_delete on public.clinics for delete to authenticated using (private.is_platform_admin());
drop policy if exists doctors_clinic_manage on public.doctors;
drop policy if exists doctors_public_read on public.doctors;
create policy doctors_select on public.doctors for select to authenticated using ((is_public and is_active and exists(select 1 from public.clinics c where c.id=doctors.clinic_id and c.is_active and c.is_public)) or private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy doctors_insert on public.doctors for insert to authenticated with check (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy doctors_update on public.doctors for update to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager','doctor'])) with check (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
create policy doctors_delete on public.doctors for delete to authenticated using (private.has_clinic_role(clinic_id,array['owner','manager','doctor']));
