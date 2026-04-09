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

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid null references public.profiles(id) on delete set null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  work_email text null,
  status text not null default 'pending' check (status in ('pending', 'active', 'archived')),
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  is_owner boolean not null default false,
  hired_at date null,
  name text not null,
  daily_rate integer not null default 0 check (daily_rate >= 0),
  archived boolean not null default false,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('planned-work', 'worked', 'day-off', 'vacation', 'sick', 'no-show')),
  rate_snapshot integer not null check (rate_snapshot >= 0),
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount integer not null check (amount >= 0),
  payment_date date not null,
  comment text not null default '',
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'rejected')),
  created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  confirmed_by_auth_user_id uuid null references auth.users(id) on delete set null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  confirmed_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_created_by_idx on public.organizations (created_by);
create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists employees_user_id_idx on public.employees (user_id);
create index if not exists employees_organization_id_idx on public.employees (organization_id);
create index if not exists employees_auth_user_id_idx on public.employees (auth_user_id);
create index if not exists employees_status_idx on public.employees (status);
create index if not exists shifts_organization_date_idx on public.shifts (organization_id, work_date);
create index if not exists payments_organization_date_idx on public.payments (organization_id, payment_date);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_created_by_profile_id_idx on public.payments (created_by_profile_id);
create unique index if not exists employees_profile_id_uidx on public.employees (profile_id) where profile_id is not null;
create unique index if not exists employees_auth_user_id_uidx on public.employees (auth_user_id) where auth_user_id is not null;
create unique index if not exists employees_organization_email_uidx
  on public.employees (organization_id, lower(work_email))
  where work_email is not null and status <> 'archived';
create unique index if not exists shifts_user_employee_date_uidx on public.shifts (user_id, employee_id, work_date);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute procedure public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute procedure public.set_updated_at();

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at
before update on public.shifts
for each row execute procedure public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute procedure public.set_updated_at();

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
    coalesce(nullif(trim(organization_name_input), ''), 'Мой ПВЗ'),
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
      'Администратор'
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
drop policy if exists "employees_select_scoped" on public.employees;
drop policy if exists "employees_insert_admin" on public.employees;
drop policy if exists "employees_update_admin" on public.employees;
drop policy if exists "employees_delete_admin" on public.employees;
drop policy if exists "shifts_select_scoped" on public.shifts;
drop policy if exists "shifts_insert_scoped" on public.shifts;
drop policy if exists "shifts_update_scoped" on public.shifts;
drop policy if exists "shifts_delete_scoped" on public.shifts;
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
  and (id = auth.uid() or public.is_admin())
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

create table if not exists public.registration_requests (
  email text primary key,
  desired_role text not null check (desired_role in ('admin', 'employee')),
  display_name text null,
  requested_at timestamptz not null default now(),
  consumed_at timestamptz null,
  consumed_by uuid null references auth.users(id) on delete set null
);

create index if not exists registration_requests_requested_at_idx
  on public.registration_requests (requested_at desc);

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
  existing_admin_id uuid;
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

  select p.id
  into existing_admin_id
  from public.profiles p
  where p.role = 'admin'
    and p.is_active = true
  order by p.created_at asc
  limit 1;

  if existing_admin_id is not null and existing_admin_id <> current_user_id then
    raise exception 'ADMIN_ALREADY_EXISTS';
  end if;

  select email into current_user_email
  from auth.users
  where id = current_user_id;

  insert into public.organizations (name, created_by)
  values (
    coalesce(nullif(trim(organization_name_input), ''), 'PVZ Schedule'),
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
      'Администратор'
    ),
    true
  );

  return jsonb_build_object(
    'organization_id', new_organization_id,
    'role', 'admin'
  );
end;
$$;

create or replace function public.request_registration(
  email_input text,
  desired_role_input text,
  display_name_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(email_input, '')));
  normalized_role text := lower(trim(coalesce(desired_role_input, '')));
  admin_exists boolean;
begin
  if normalized_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if normalized_role not in ('admin', 'employee') then
    raise exception 'INVALID_ROLE';
  end if;

  select exists(
    select 1
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
  ) into admin_exists;

  if normalized_role = 'admin' and admin_exists then
    raise exception 'ADMIN_ALREADY_EXISTS';
  end if;

  if normalized_role = 'employee' and not admin_exists then
    raise exception 'ADMIN_REQUIRED';
  end if;

  insert into public.registration_requests (
    email,
    desired_role,
    display_name,
    requested_at,
    consumed_at,
    consumed_by
  )
  values (
    normalized_email,
    normalized_role,
    nullif(trim(display_name_input), ''),
    now(),
    null,
    null
  )
  on conflict (email) do update
  set desired_role = excluded.desired_role,
      display_name = excluded.display_name,
      requested_at = now(),
      consumed_at = null,
      consumed_by = null;

  return jsonb_build_object(
    'email', normalized_email,
    'desired_role', normalized_role
  );
end;
$$;

create or replace function public.ensure_profile_from_registration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  current_user_confirmed_at timestamptz;
  existing_profile public.profiles;
  request_row public.registration_requests;
  admin_profile public.profiles;
  target_org public.organizations;
  target_employee public.employees;
  owner_user_id uuid;
  fallback_name text;
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

  select au.email, au.email_confirmed_at
  into current_user_email, current_user_confirmed_at
  from auth.users au
  where au.id = current_user_id;

  if current_user_email is null or trim(current_user_email) = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if current_user_confirmed_at is null then
    raise exception 'EMAIL_NOT_CONFIRMED';
  end if;

  select rr.*
  into request_row
  from public.registration_requests rr
  where rr.email = lower(current_user_email)
  limit 1
  for update;

  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;

  fallback_name := coalesce(
    nullif(trim(request_row.display_name), ''),
    nullif(split_part(current_user_email, '@', 1), ''),
    'Сотрудник'
  );

  if request_row.desired_role = 'admin' then
    select p.*
    into admin_profile
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    if found and admin_profile.id <> current_user_id then
      raise exception 'ADMIN_ALREADY_EXISTS';
    end if;

    select o.*
    into target_org
    from public.organizations o
    where o.created_by = current_user_id
    order by o.created_at asc
    limit 1;

    if not found then
      insert into public.organizations (name, created_by)
      values ('PVZ Schedule', current_user_id)
      returning * into target_org;
    end if;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, target_org.id, 'admin', fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = 'admin',
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();
  else
    select p.*
    into admin_profile
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    if not found then
      raise exception 'ADMIN_REQUIRED';
    end if;

    select o.*
    into target_org
    from public.organizations o
    where o.id = admin_profile.organization_id
    limit 1;

    if not found then
      raise exception 'ADMIN_REQUIRED';
    end if;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, target_org.id, 'employee', fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = 'employee',
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    owner_user_id := coalesce(target_org.created_by, admin_profile.id);

    select e.*
    into target_employee
    from public.employees e
    where e.organization_id = target_org.id
      and lower(coalesce(e.work_email, '')) = lower(current_user_email)
    order by
      case when e.status = 'pending' then 0 else 1 end,
      e.created_at asc
    limit 1
    for update;

    if found then
      if target_employee.profile_id is not null and target_employee.profile_id <> current_user_id then
        raise exception 'EMPLOYEE_ALREADY_LINKED';
      end if;

      update public.employees
      set profile_id = current_user_id,
          auth_user_id = current_user_id,
          work_email = lower(current_user_email),
          status = 'active',
          archived = false,
          archived_at = null,
          name = coalesce(nullif(name, ''), fallback_name),
          updated_at = now()
      where id = target_employee.id;
    else
      insert into public.employees (
        user_id,
        organization_id,
        profile_id,
        auth_user_id,
        work_email,
        status,
        created_by_profile_id,
        is_owner,
        hired_at,
        name,
        daily_rate,
        archived,
        archived_at
      )
      values (
        owner_user_id,
        target_org.id,
        current_user_id,
        current_user_id,
        lower(current_user_email),
        'active',
        admin_profile.id,
        false,
        current_date,
        fallback_name,
        0,
        false,
        null
      );
    end if;
  end if;

  update public.registration_requests rr
  set consumed_at = now(),
      consumed_by = current_user_id
  where rr.email = request_row.email;

  select p.*
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  return jsonb_build_object(
    'organization_id', existing_profile.organization_id,
    'role', existing_profile.role
  );
end;
$$;

grant execute on function public.request_registration(text, text, text) to anon;
grant execute on function public.request_registration(text, text, text) to authenticated;
grant execute on function public.ensure_profile_from_registration() to authenticated;
