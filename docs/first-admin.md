# First Super Admin provisioning

Never create a Super Admin from public signup, a client-side profile edit, or a hardcoded password.

1. In Supabase Auth, create or invite the intended administrator using an operator-controlled email address and a strong unique password. Verify the email and the operator's identity; require MFA where available.
2. Record the verified Auth user UUID.
3. In the Supabase SQL Editor, while signed in as a trusted project owner, grant the role to that exact verified UUID:

   ```sql
   insert into public.platform_roles (user_id, role)
   values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'super_admin')
   on conflict (user_id) do update set role = excluded.role;
   ```

4. Confirm the administrator can sign in and that no public-facing flow can write to `platform_roles`.
5. Keep the recovery procedure in access-control records. Never share the SQL Editor account or service-role key with clinic staff.

## Server-side service-role configuration

The Vercel project has a `SUPABASE_SERVICE_ROLE_KEY` Production entry, but an authorized environment inspection confirmed that its stored value is empty. The `VAPID_PRIVATE_KEY` and `CRON_SECRET` Production entries are also empty. Do not treat the presence of an empty entry as a configured secret.

1. In the Supabase Dashboard for project `kfzxebxwicfhbvwhdzrt`, open **Project Settings → API Keys** and copy the server-side `service_role` secret (not the publishable/anon key).
2. In Vercel, open the `doctor-queue` project → **Settings → Environment Variables**. Inspect the existing `SUPABASE_SERVICE_ROLE_KEY` entry. If empty or invalid, paste the secret as a **Sensitive/Encrypted** value for **Production only**. Do not add a `NEXT_PUBLIC_` prefix, put it in GitHub, or paste it into chat.
3. Trigger a production deployment after the environment change. Verify the clinic-provisioning and staff-invitation endpoints with a verified Super Admin and a synthetic clinic before onboarding real clinics.
4. In Supabase Auth URL configuration, allow-list the deployed production callback URL used by the password recovery flow. Do not use a wildcard redirect.

The first-admin grant is intentionally manual because a bootstrap endpoint or hardcoded credential would create an unsafe privilege-escalation path. Do not treat the platform as production-ready until both the verified administrator and server-side secret are configured and tested.
