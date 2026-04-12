create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin', 'employee')),
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees
  add column if not exists organization_id uuid null references public.organizations(id) on delete cascade,
  add column if not exists profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists work_email text null,
  add column if not exists status text null,
  add column if not exists created_by_profile_id uuid null references public.profiles(id) on delete set null;

alter table public.shifts
  add column if not exists organization_id uuid null references public.organizations(id) on delete cascade,
  add column if not exists created_by_profile_id uuid null references public.profiles(id) on delete set null;

alter table public.payments
  add column if not exists organization_id uuid null references public.organizations(id) on delete cascade,
  add column if not exists created_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists confirmed_by_profile_id uuid null references public.profiles(id) on delete set null;

with owner_ids as (
  select distinct e.user_id as owner_user_id
  from public.employees e
),
missing_orgs as (
  select owner_user_id
  from owner_ids owners
  where not exists (
    select 1
    from public.organizations org
    where org.created_by = owners.owner_user_id
  )
)
insert into public.organizations (name, created_by)
select '��� ' || left(owner_user_id::text, 8), owner_user_id
from missing_orgs;

update public.employees e
set organization_id = org.id
from public.organizations org
where e.organization_id is null
  and org.created_by = e.user_id;

update public.shifts s
set organization_id = e.organization_id
from public.employees e
where s.organization_id is null
  and s.employee_id = e.id;

update public.payments p
set organization_id = e.organization_id
from public.employees e
where p.organization_id is null
  and p.employee_id = e.id;

update public.shifts s
set organization_id = org.id
from public.organizations org
where s.organization_id is null
  and org.created_by = s.user_id;

update public.payments p
set organization_id = org.id
from public.organizations org
where p.organization_id is null
  and org.created_by = p.user_id;

insert into public.profiles (id, organization_id, role, display_name, is_active)
select
  org.created_by,
  org.id,
  'admin',
  coalesce(owner_employee.name, '�������������'),
  true
from public.organizations org
left join lateral (
  select e.name
  from public.employees e
  where e.organization_id = org.id
    and (e.is_owner = true or e.auth_user_id = org.created_by)
  order by e.created_at asc
  limit 1
) as owner_employee on true
where org.created_by is not null
on conflict (id) do update
set organization_id = excluded.organization_id,
    role = 'admin',
    display_name = excluded.display_name,
    is_active = true,
    updated_at = now();

insert into public.profiles (id, organization_id, role, display_name, is_active)
select
  e.auth_user_id,
  e.organization_id,
  case when e.auth_user_id = org.created_by then 'admin' else 'employee' end,
  e.name,
  true
from public.employees e
join public.organizations org on org.id = e.organization_id
where e.auth_user_id is not null
on conflict (id) do update
set organization_id = excluded.organization_id,
    role = case when public.profiles.role = 'admin' then 'admin' else excluded.role end,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    is_active = true,
    updated_at = now();

update public.employees e
set profile_id = e.auth_user_id
where e.auth_user_id is not null
  and e.profile_id is null;

update public.employees e
set work_email = au.email
from auth.users au
where e.work_email is null
  and e.auth_user_id = au.id;

update public.employees
set status = case
  when coalesce(archived, false) then 'archived'
  when profile_id is not null then 'active'
  else 'pending'
end
where status is null
   or status = '';

update public.employees e
set created_by_profile_id = org.created_by
from public.organizations org
where e.created_by_profile_id is null
  and e.organization_id = org.id;

update public.shifts s
set created_by_profile_id = org.created_by
from public.organizations org
where s.created_by_profile_id is null
  and s.organization_id = org.id;

update public.payments p
set created_by_profile_id = coalesce(p.created_by_auth_user_id, org.created_by)
from public.organizations org
where p.created_by_profile_id is null
  and p.organization_id = org.id;

update public.payments p
set confirmed_by_profile_id = p.confirmed_by_auth_user_id
where p.confirmed_by_profile_id is null
  and p.confirmed_by_auth_user_id is not null;

update public.payments
set status = 'pending_confirmation'
where status = 'entered';

update public.payments
set status = 'confirmed'
where status is null or status = '';

alter table public.employees
  drop constraint if exists employees_status_check;

alter table public.employees
  add constraint employees_status_check
  check (status in ('pending', 'active', 'archived'));

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending_confirmation', 'confirmed', 'rejected'));

alter table public.payments
  alter column status set default 'pending_confirmation';

alter table public.employees
  alter column status set default 'pending';

alter table public.employees
  alter column organization_id set not null,
  alter column status set not null;

alter table public.shifts
  alter column organization_id set not null;

alter table public.payments
  alter column organization_id set not null;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute procedure public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists employees_organization_id_idx on public.employees (organization_id);
create index if not exists employees_status_idx on public.employees (status);
create index if not exists shifts_organization_date_idx on public.shifts (organization_id, work_date);
create index if not exists payments_organization_date_idx on public.payments (organization_id, payment_date);
create index if not exists payments_created_by_profile_id_idx on public.payments (created_by_profile_id);

create unique index if not exists employees_profile_id_uidx
  on public.employees (profile_id)
  where profile_id is not null;

create unique index if not exists employees_organization_email_uidx
  on public.employees (organization_id, lower(work_email))
  where work_email is not null and status <> 'archived';

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select (public.current_profile()).organization_id
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select (public.current_profile()).role
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false)
$$;

create or replace function public.my_employee_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.profile_id = auth.uid()
    and e.organization_id = public.current_organization_id()
    and e.status = 'active'
  order by e.created_at asc
  limit 1
$$;

create or replace function public.bootstrap_admin_account(
  organization_name_input text default null,
  display_name_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  existing_profile public.profiles;
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if found then
    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  select email into current_user_email
  from auth.users
  where id = current_user_id;

  insert into public.organizations (name, created_by)
  values (
    coalesce(nullif(trim(organization_name_input), ''), '��� ���'),
    current_user_id
  )
  returning id into new_organization_id;

  insert into public.profiles (id, organization_id, role, display_name, is_active)
  values (
    current_user_id,
    new_organization_id,
    'admin',
    coalesce(
      nullif(trim(display_name_input), ''),
      nullif(split_part(coalesce(current_user_email, ''), '@', 1), ''),
      '�������������'
    ),
    true
  );

  return jsonb_build_object(
    'organization_id', new_organization_id,
    'role', 'admin'
  );
end;
$$;

create or replace function public.activate_employee_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  match_count integer;
  target_employee public.employees;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if exists (
    select 1
    from public.employees e
    where e.profile_id = current_user_id
  ) then
    raise exception 'EMPLOYEE_ALREADY_LINKED';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.role = 'admin'
  ) then
    raise exception 'PROFILE_ALREADY_BOUND';
  end if;

  select au.email
  into current_user_email
  from auth.users au
  where au.id = current_user_id;

  if current_user_email is null or trim(current_user_email) = '' then
    raise exception 'EMAIL_NOT_FOUND';
  end if;

  if exists (
    select 1
    from auth.users au
    where au.id = current_user_id
      and au.email_confirmed_at is null
  ) then
    raise exception 'EMAIL_NOT_CONFIRMED';
  end if;

  select count(*)
  into match_count
  from public.employees e
  where lower(e.work_email) = lower(current_user_email)
    and e.status = 'pending';

  if match_count = 0 then
    raise exception 'EMAIL_NOT_FOUND';
  end if;

  if match_count > 1 then
    raise exception 'DUPLICATE_EMAIL_MATCH';
  end if;

  select e.*
  into target_employee
  from public.employees e
  where lower(e.work_email) = lower(current_user_email)
    and e.status = 'pending'
  limit 1
  for update;

  if not found then
    raise exception 'EMAIL_NOT_FOUND';
  end if;

  if target_employee.status = 'archived' then
    raise exception 'EMPLOYEE_ARCHIVED';
  end if;

  if target_employee.profile_id is not null then
    raise exception 'EMPLOYEE_ALREADY_LINKED';
  end if;

  insert into public.profiles (id, organization_id, role, display_name, is_active)
  values (
    current_user_id,
    target_employee.organization_id,
    'employee',
    target_employee.name,
    true
  )
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      role = 'employee',
      display_name = excluded.display_name,
      is_active = true,
      updated_at = now();

  update public.employees
  set profile_id = current_user_id,
      auth_user_id = current_user_id,
      status = 'active',
      archived = false,
      archived_at = null,
      updated_at = now()
  where id = target_employee.id;

  return jsonb_build_object(
    'organization_id', target_employee.organization_id,
    'employee_id', target_employee.id,
    'role', 'employee'
  );
end;
$$;

grant execute on function public.current_profile() to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_employee_id() to authenticated;
grant execute on function public.bootstrap_admin_account(text, text) to authenticated;
grant execute on function public.activate_employee_account() to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.payments enable row level security;

drop policy if exists "organizations_select_scoped" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "profiles_select_scoped" on public.profiles;
drop policy if exists "profiles_update_scoped" on public.profiles;
drop policy if exists "employees_select_owner_or_self" on public.employees;
drop policy if exists "employees_insert_owner" on public.employees;
drop policy if exists "employees_update_owner" on public.employees;
drop policy if exists "employees_delete_owner" on public.employees;
drop policy if exists "employees_select_scoped" on public.employees;
drop policy if exists "employees_insert_admin" on public.employees;
drop policy if exists "employees_update_admin" on public.employees;
drop policy if exists "employees_delete_admin" on public.employees;
drop policy if exists "shifts_select_owner_or_employee" on public.shifts;
drop policy if exists "shifts_insert_owner" on public.shifts;
drop policy if exists "shifts_update_owner" on public.shifts;
drop policy if exists "shifts_delete_owner" on public.shifts;
drop policy if exists "shifts_select_scoped" on public.shifts;
drop policy if exists "shifts_insert_scoped" on public.shifts;
drop policy if exists "shifts_update_scoped" on public.shifts;
drop policy if exists "shifts_delete_scoped" on public.shifts;
drop policy if exists "payments_select_owner_or_employee" on public.payments;
drop policy if exists "payments_insert_owner_or_employee" on public.payments;
drop policy if exists "payments_update_owner_or_employee" on public.payments;
drop policy if exists "payments_delete_owner_or_employee" on public.payments;
drop policy if exists "payments_select_scoped" on public.payments;
drop policy if exists "payments_insert_scoped" on public.payments;
drop policy if exists "payments_update_scoped" on public.payments;
drop policy if exists "payments_delete_scoped" on public.payments;

create policy "organizations_select_scoped" on public.organizations
for select
using (id = public.current_organization_id());

create policy "organizations_update_admin" on public.organizations
for update
using (public.is_admin() and id = public.current_organization_id())
with check (public.is_admin() and id = public.current_organization_id());

create policy "profiles_select_scoped" on public.profiles
for select
using (
  id = auth.uid()
  or (public.is_admin() and organization_id = public.current_organization_id())
);

create policy "profiles_update_scoped" on public.profiles
for update
using (
  id = auth.uid()
  or (public.is_admin() and organization_id = public.current_organization_id())
)
with check (
  organization_id = public.current_organization_id()
  and (
    id = auth.uid()
    or public.is_admin()
  )
);

create policy "employees_select_scoped" on public.employees
for select
using (organization_id = public.current_organization_id());

create policy "employees_insert_admin" on public.employees
for insert
with check (
  public.is_admin()
  and organization_id = public.current_organization_id()
);

create policy "employees_update_admin" on public.employees
for update
using (
  public.is_admin()
  and organization_id = public.current_organization_id()
)
with check (
  public.is_admin()
  and organization_id = public.current_organization_id()
);

create policy "employees_delete_admin" on public.employees
for delete
using (
  public.is_admin()
  and organization_id = public.current_organization_id()
);

create policy "shifts_select_scoped" on public.shifts
for select
using (organization_id = public.current_organization_id());

create policy "shifts_insert_scoped" on public.shifts
for insert
with check (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    not public.is_admin()
    and organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and created_by_profile_id = auth.uid()
  )
);

create policy "shifts_update_scoped" on public.shifts
for update
using (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
  )
)
with check (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and created_by_profile_id = auth.uid()
  )
);

create policy "shifts_delete_scoped" on public.shifts
for delete
using (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
  )
);

create policy "payments_select_scoped" on public.payments
for select
using (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
  )
);

create policy "payments_insert_scoped" on public.payments
for insert
with check (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and status = 'pending_confirmation'
    and created_by_profile_id = auth.uid()
    and confirmed_by_profile_id is null
  )
);

create policy "payments_update_scoped" on public.payments
for update
using (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and status = 'pending_confirmation'
    and created_by_profile_id = auth.uid()
  )
)
with check (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and status = 'pending_confirmation'
    and created_by_profile_id = auth.uid()
    and confirmed_by_profile_id is null
  )
);

create policy "payments_delete_scoped" on public.payments
for delete
using (
  (
    public.is_admin()
    and organization_id = public.current_organization_id()
  )
  or (
    organization_id = public.current_organization_id()
    and employee_id = public.my_employee_id()
    and status = 'pending_confirmation'
    and created_by_profile_id = auth.uid()
  )
);

drop function if exists public.claim_employee_invite(text);
drop function if exists public.regenerate_employee_invite(uuid);
drop function if exists public.generate_invite_code();

