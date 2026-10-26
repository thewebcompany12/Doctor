# Database migration and security notes

## Applied production history (verified 2026-10-26)

The connected Supabase project reports these applied migration versions:

1. `20261026144621 doctor_queue_foundation`
2. `20261026144629 public_queue_privacy_view`
3. `20261026144755 public_queue_status_view_access`
4. `20261026144924 atomic_queue_operations`
5. `20261026145147 queue_mutation_security_hardening`
6. `20261026151259 public_api_privilege_hardening`
7. `20261026151630 first_login_password_change`
8. `20261026151957 queue_operation_guards`
9. `20261026152016 queue_advance_current_token_guard`
10. `20261026152153 clinic_queue_setup_and_controls`
11. `20261026152314 queue_status_audit_fix`
12. `20261026152346 queue_transition_call_guard`
13. `20261026152528 audit_log_write_lockdown`

The repository now contains version-matched SQL files for this history. The foundation migration was reconstructed from live catalog metadata (columns, constraints, indexes, RLS policies and helper functions) because the original applied source was absent from GitHub. **It has not yet been proven by applying the entire chain to a clean disposable database.** Do not describe the chain as clean-install verified until that test is performed.

## Safe workflow

- Back up the database before schema changes.
- Never reset or truncate the production project to test migrations.
- Apply versioned migrations to a disposable Supabase branch or local Supabase/Postgres environment first.
- Compare the resulting schema, functions, policies, indexes and grants against production before applying any reconciliation.
- Keep migration filenames aligned with the versions recorded in `supabase_migrations.schema_migrations`.
- If production was changed outside versioned migrations, add a forward-only reconciliation migration; do not rewrite historical production state.
- Queue allocation must go through `issue_staff_token`; transitions must go through `transition_queue_token`; next-patient selection uses `advance_queue`. These functions check clinic membership, lock rows and accept idempotency keys. Daily token limits count all issued tokens, including skipped/absent/cancelled tokens. A clean-install concurrency test remains outstanding.

## Anonymous API surface

The intended public surface is only `public.public_queue_status`, which returns clinic/doctor display fields and aggregate queue counts. It deliberately excludes patient names, phone hashes, tracking secrets and appointment details. The view uses owner privileges to aggregate private base tables, so Supabase's `security_definer_view` advisor finding remains a documented exception requiring a dedicated security review. Anonymous direct table privileges have been revoked; only SELECT on the curated view is granted to `anon`.

## Known scope gaps

The current schema does not contain branch or appointment tables. The Super Admin clinic directory now supports search, create/onboard, edit, activate, suspend and archive controls. Temporary-password onboarding is enforced through a first-login password-change page. The workspace now includes owner/manager queue setup and staff queue operations (issue walk-in token, call next, pause/resume/close, start/complete, skip with reason, absent and cancel). Online booking is only a stored setting; public online token issuance is not implemented. The workspace still lacks full clinic profile, schedules, branches, staff invitations and account recovery management. RLS policies have been inspected, and direct anonymous table access plus authenticated audit-log writes have been restricted. Synthetic multi-clinic authenticated/unauthenticated integration tests have not been run. No production data was reset or deleted.
