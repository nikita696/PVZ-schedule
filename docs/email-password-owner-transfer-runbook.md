# Email/password auth and owner transfer runbook

## Backup checklist

Before pushing the migration to production:

1. Dump public data outside the repo:
   `npx.cmd supabase db dump --linked --data-only --schema public --file ..\state\pvz-backups\pvz-public-before-email-password.sql`
2. Record invariant counts:
   ```sql
   select
     (select count(*) from public.organizations) as organizations,
     (select count(*) from public.employees) as employees,
     (select count(*) from public.shifts) as shifts,
     (select count(*) from public.payments) as payments,
     (select count(*) from public.employee_rate_history) as employee_rate_history,
     (select count(*) from public.schedule_months) as schedule_months,
     (select count(*) from public.profiles where role = 'admin' and is_active = true) as active_admins;
   ```
3. Record the current organization id:
   ```sql
   select id, created_by from public.organizations order by created_at asc;
   ```
4. Do not delete auth users during the migration. Deactivate profiles through the claim flow instead.

## Supabase dashboard steps

1. Auth > Providers > Email: enable Email provider.
2. Enable email/password signups for the migration window.
3. Keep Site URL as `https://pvz-schedule.vercel.app`.
4. Keep redirect URLs for production and previews:
   `https://pvz-schedule.vercel.app/**`,
   `https://pvz-schedule-nick-rimers-projects.vercel.app/**`,
   `https://*-nick-rimers-projects.vercel.app/**`,
   `http://localhost:5173/**`,
   `http://127.0.0.1:5173/**`.
5. Create users from Auth > Users only when a person must be pre-created. Prefer normal sign-up for employees.

## Temporary dev admin

The temporary admin account must use an email controlled by Nick and must be separate from Nick's employee email.

Preferred path:

1. Sign in as the current active admin.
2. Open `/admin/settings`.
3. In Owner transfer, enter the temporary admin email and display name `Татьяна`.
4. Create the transfer.
5. Sign out.
6. Sign up or sign in with the temporary admin email/password.
7. On `/auth/login`, click `Забрать права администратора`.

SQL fallback if the current admin cannot sign in after provider changes:

```sql
begin;

with active_admin as (
  select p.*
  from public.profiles p
  where p.role = 'admin' and p.is_active = true
  order by p.created_at asc
  limit 1
)
insert into public.owner_admin_claims (
  organization_id,
  target_email,
  target_display_name,
  status,
  requested_by_profile_id,
  source_admin_profile_id,
  notes
)
select
  active_admin.organization_id,
  lower('TEMP_ADMIN_EMAIL_HERE'),
  'Татьяна',
  'pending',
  active_admin.id,
  active_admin.id,
  'created from Supabase SQL fallback'
from active_admin;

select public.append_audit_log(
  active_admin.organization_id,
  null,
  'owner_admin_claim',
  c.id,
  'owner_admin_claim_created_sql_fallback',
  null,
  to_jsonb(c)
)
from public.owner_admin_claims c
join active_admin on active_admin.organization_id = c.organization_id
where c.status = 'pending'
  and lower(c.target_email) = lower('TEMP_ADMIN_EMAIL_HERE');

commit;
```

Then sign in with that temp admin email and click `Забрать права администратора`.

## Nick employee account

1. Use the temporary admin account.
2. Open `/admin/employees`.
3. Create or keep a non-owner employee row named `Ник` with Nick's employee email.
4. The employee email must be different from the temporary admin email.
5. Sign up or sign in with Nick's employee email/password.
6. The server links that session to the matching employee row by `employees.work_email`.

## Real Tatiana transfer

1. Real Tatiana registers with her real email/password.
2. Temporary admin opens `/admin/settings`.
3. Create an Owner transfer for Tatiana's real email and display name `Татьяна`.
4. Tatiana signs in.
5. Tatiana clicks `Забрать права администратора`.
6. The RPC relinks the existing owner employee row to Tatiana's auth user, updates `organizations.created_by`, moves legacy `user_id` references to the new owner, deactivates the previous active admin profile, and writes an audit log entry.

## Verification SQL

Run after the migration and after each owner transfer:

```sql
select count(*) as active_admins
from public.profiles
where role = 'admin' and is_active = true;

select id, created_by
from public.organizations
order by created_at asc;

select
  (select count(*) from public.shifts) as shifts,
  (select count(*) from public.payments) as payments,
  (select count(*) from public.employee_rate_history) as employee_rate_history,
  (select count(*) from public.schedule_months) as schedule_months;

select e.id, e.name, e.is_owner, e.status, p.role, p.is_active
from public.employees e
left join public.profiles p on p.id = e.profile_id
order by e.is_owner desc, e.created_at asc;

select action, created_at
from public.audit_log
where action in (
  'owner_admin_claim_created',
  'owner_admin_claim_created_sql_fallback',
  'owner_admin_claim_completed',
  'owner_admin_claim_cancelled'
)
order by created_at desc
limit 20;
```

Expected invariants:

- Organization id is unchanged.
- `shifts`, `payments`, `employee_rate_history`, and `schedule_months` counts are unchanged.
- There is exactly one active admin profile.
- The owner employee row id is preserved across transfer.
- Nick employee login resolves to a non-owner employee row.
- Temporary admin resolves to admin before Tatiana claims.
- Real Tatiana resolves to admin after claim.

## Rollback plan

Frontend rollback:

1. Revert the auth change commit.
2. Redeploy the previous Vercel build.

Database rollback:

1. Do not delete business tables.
2. If no claim was completed, drop only the new owner claim objects:
   ```sql
   drop function if exists public.claim_owner_admin_from_session();
   drop function if exists public.cancel_owner_admin_claim(uuid);
   drop function if exists public.create_owner_admin_claim(text, text, text);
   drop table if exists public.owner_admin_claims;
   ```
3. If a claim was completed, rollback by creating a new owner transfer back to the previous admin email. Prefer the forward claim flow over manual ID rewrites.
4. Restore public data from the dump only if verification shows business data corruption. Never restore by wiping tables first without a separate reviewed restore plan.
