alter policy appointments_patient_or_staff_read on public.appointments
using ((patient_user_id = (select auth.uid())) or private.is_platform_admin() or private.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']));
alter policy appointments_staff_create on public.appointments
with check ((created_by = (select auth.uid())) and private.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist']));
alter policy memberships_member_or_admin_read on public.clinic_memberships
using ((user_id = (select auth.uid())) or private.has_clinic_role(clinic_id,array['owner','manager']));
alter policy platform_roles_admin_only on public.platform_roles
using (private.is_platform_admin() or (user_id = (select auth.uid())));
alter policy profiles_read_self on public.profiles
using ((id = (select auth.uid())) or private.is_platform_admin());
alter policy profiles_update_self on public.profiles
using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy events_staff_insert on public.queue_events
with check (private.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']) and actor_user_id = (select auth.uid()));
