# First Super Admin provisioning

Never create a Super Admin from public signup, a client-side profile edit, or a hardcoded password.

1. In Supabase Auth, create or invite the intended administrator using an operator-controlled email address and a strong unique password. Require MFA where available.
2. Verify the operator's identity and record the Auth user UUID.
3. In the Supabase SQL Editor, while signed in as a trusted project owner, grant the role to that verified UUID:

    insert into public.platform_roles (user_id, role) values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'super_admin') on conflict (user_id) do update set role = excluded.role;

4. Confirm the administrator can sign in and that no public-facing flow can write to platform_roles.
5. Store the recovery procedure in your access-control records. Never share the SQL Editor account or service-role key with clinic staff.

The first-admin grant is intentionally manual because a bootstrap endpoint or hardcoded credential would create an unsafe privilege-escalation path.
