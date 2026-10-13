# KJM Rental Management

Independent private administration application for KJM Motorcycle Rental. This directory is a separate Next.js application from `KJM MAIN` and must have its own Vercel project, environment variables, dependency lifecycle, and deployment controls.

## Admin-managed fleet status

- `/sign-in` accepts a numeric PIN. The server maps it to the configured Supabase Auth identity and then verifies an active `admin_users` row.
- `/dashboard` displays real fleet totals and audited fleet activity.
- `/dashboard/fleet` supports search, filtering, model/specification/pricing management, private physical units, publication, archiving, and governed gallery media.
- All mutations run as the signed-in user, remain subject to RLS, and write audit records.
- Customer, booking, payment, and finance workflows remain out of scope.

Use Vercel deployment protection for non-production admin previews. Supabase Auth, server-side staff verification, and database RLS provide the application authorization boundary.

## Local setup

```bash
cd "/Users/mac/Desktop/KJM/KJM ADMIN"
npm ci
cp .env.example .env.local
npm run dev
```

The app defaults to [http://localhost:3000](http://localhost:3000). Use another port when `KJM MAIN` is running:

```bash
npm run dev -- --port 3001
```

Set the shared Supabase project's public browser-safe variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ADMIN_LOGIN_EMAIL=your-admin-auth-user@example.com
```

Never expose a service-role key, database password, JWT secret, or other privileged credential through `NEXT_PUBLIC_*`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Shared backend ownership

Both KJM applications will eventually use one Supabase project. The public and admin apps must not maintain competing migration histories. A single reviewed migration source of truth should live in `KJM MAIN/supabase/migrations` until a dedicated infrastructure repository is approved. The admin app consumes the shared schema but does not create independent migrations.

Canonical migrations live only in `KJM MAIN/supabase/migrations`; they are not duplicated here.

## First administrator bootstrap

There is no public registration and the application never promotes users automatically.

1. In the Supabase dashboard for the shared KJM project, create or invite the administrator under Authentication → Users.
   The account password is managed by the application as a server-derived credential; administrators enter only a four-digit PIN.
2. Copy the new Auth user's UUID.
3. As a trusted project operator, run this in the Supabase SQL editor:

```sql
insert into public.admin_users (auth_user_id, role, is_active)
values ('AUTH-USER-UUID-HERE', 'admin', true)
on conflict (auth_user_id)
do update set role = excluded.role, is_active = excluded.is_active;
```

4. Set the same account email as the server-only `ADMIN_LOGIN_EMAIL` environment variable, then sign in at `/sign-in` using only its PIN.

Set the initial PIN using the trusted bootstrap procedure, then change it from Dashboard → Settings. `ADMIN_PIN_PEPPER` must be a unique server-only random value shared by all deployments of KJM ADMIN.

Never expose the SQL editor, a service-role key, or administrator credentials to the browser.

## Before deployment

1. Apply all reviewed migrations from `KJM MAIN/supabase/migrations` in order.
2. Create staff identities through Supabase Auth and add matching active `admin_users` records through a secure operator process.
3. Confirm the `motorcycle-catalog` bucket and RLS policies in the target project.
4. Configure the same public Supabase URL/key in both Vercel projects; never add a service-role key to either frontend.
5. Run authorization, audit-log, upload, and publish/unpublish smoke tests against a non-production Supabase project.
