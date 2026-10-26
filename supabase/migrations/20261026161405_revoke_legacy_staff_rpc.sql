-- Remove execute access to the legacy four-argument staff membership definer.
-- The current API uses the five-argument service-role-only RPC with an explicit
-- actor UUID taken from a verified Supabase session.
revoke all on function private.attach_invited_staff(uuid,uuid,text,text) from public,anon,authenticated,service_role;
