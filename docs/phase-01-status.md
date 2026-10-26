# Phase 01 — Foundation status

The connected project has a Next.js App Router and TypeScript application shell, Supabase SSR/browser clients, responsive landing page, public clinic directory route, login route, authenticated workspace route, environment variable example, and baseline setup documentation.

The connected Supabase project has 13 application tables with RLS enabled, clinic memberships, doctor and queue relationships, indexes, role-check helper functions, a public-safe queue summary view, atomic staff token issuance and state-transition functions, and a migration restricting direct token/queue mutations.

The GitHub repository is `thewebcompany12/Doctor`, branch `main`. The Vercel project is `doctor-queue`.

Not yet verified: automated test suite, clean local install/build/typecheck/lint in this execution, full application-level authorization audit, admin provisioning UX, end-to-end queue workflows, and production-readiness. Do not use this foundation for real patient traffic until these checks pass.