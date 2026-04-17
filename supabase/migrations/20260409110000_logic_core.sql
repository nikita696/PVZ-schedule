begin;

create table if not exists public.employee_rate_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  rate integer not null check (rate >= 0),
  valid_from date not null,
  valid_to date null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_months (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'closed')),
  approved_by_profile_id uuid null references public.profiles(id) on delete set null,
  approved_at timestamptz null,
  closed_by_profile_id uuid null references public.profiles(id) on delete set null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  old_value jsonb null,
  new_value jsonb null,
  created_at timestamptz not null default now()
);

alter table public.employees
  add column if not exists terminated_at date null;

update public.employees
set status = 'active'
where status = 'pending';

alter table public.employees drop constraint if exists employees_status_check;
alter table public.employees
  add constraint employees_status_check
  check (status in ('active', 'archived'));

alter table public.shifts
  add column if not exists requested_status text null,
  add column if not exists approved_status text null,
  add column if not exists actual_status text null,
  add column if not exists requested_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists approved_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists actual_by_profile_id uuid null references public.profiles(id) on delete set null;

alter table public.shifts drop constraint if exists shifts_status_check;

update public.shifts
set status = case status
  when 'planned-work' then 'shift'
  when 'worked' then 'shift'
  when 'day-off' then 'day_off'
  when 'vacation' then 'day_off'
  when 'sick' then 'sick_leave'
  when 'no-show' then 'no_show'
  else coalesce(status, 'no_shift')
end;

update public.shifts
set requested_status = coalesce(requested_status, status),
    approved_status = coalesce(approved_status, status),
    requested_by_profile_id = coalesce(requested_by_profile_id, created_by_profile_id);

alter table public.shifts
  add constraint shifts_status_check
  check (status in ('shift', 'day_off', 'sick_leave', 'no_show', 'replacement', 'no_shift'));

alter table public.payments
  add column if not exists requested_by_auth_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists approved_by_auth_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists requested_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists approved_by_profile_id uuid null references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz null,
  add column if not exists edited_by_admin boolean not null default false;

alter table public.payments drop constraint if exists payments_status_check;

update public.payments
set requested_by_auth_user_id = coalesce(requested_by_auth_user_id, created_by_auth_user_id),
    approved_by_auth_user_id = coalesce(approved_by_auth_user_id, confirmed_by_auth_user_id),
    requested_by_profile_id = coalesce(requested_by_profile_id, created_by_profile_id),
    approved_by_profile_id = coalesce(approved_by_profile_id, confirmed_by_profile_id),
    approved_at = case when status = 'confirmed' then coalesce(approved_at, updated_at) else approved_at end;

update public.payments
set status = case status
  when 'pending_confirmation' then 'pending'
  when 'confirmed' then 'approved'
  else coalesce(status, 'pending')
end;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'approved', 'rejected'));

with ranked_admins as (
  select
    p.id,
    row_number() over (
      order by
        case
          when lower(coalesce(au.email, '')) = 'nikita696@yandex.ru' then 0
          when lower(coalesce(au.email, '')) like 'qa_test_%' then 2
          when lower(coalesce(au.email, '')) like 'codex.verify+%' then 2
          else 1
        end,
        p.created_at asc,
        p.id asc
    ) as row_num
  from public.profiles p
  left join auth.users au on au.id = p.id
  where p.role = 'admin' and p.is_active = true
)
update public.profiles p
set is_active = false,
    updated_at = now()
from ranked_admins ra
where p.id = ra.id
  and ra.row_num > 1;

create unique index if not exists profiles_single_active_admin_uidx
  on public.profiles ((1))
  where role = 'admin' and is_active = true;

create unique index if not exists employee_rate_history_employee_valid_from_uidx
  on public.employee_rate_history (employee_id, valid_from);

create unique index if not exists schedule_months_org_year_month_uidx
  on public.schedule_months (organization_id, year, month);

create index if not exists employee_rate_history_employee_period_idx
  on public.employee_rate_history (employee_id, valid_from desc, valid_to);

create index if not exists schedule_months_org_period_idx
  on public.schedule_months (organization_id, year desc, month desc);

create index if not exists audit_log_org_created_at_idx
  on public.audit_log (organization_id, created_at desc);

insert into public.employee_rate_history (
  organization_id,
  employee_id,
  rate,
  valid_from,
  valid_to,
  created_by_profile_id,
  created_at
)
select
  e.organization_id,
  e.id,
  e.daily_rate,
  coalesce(e.hired_at, e.created_at::date),
  coalesce(e.terminated_at, case when e.status = 'archived' then e.archived_at::date else null end),
  e.created_by_profile_id,
  e.created_at
from public.employees e
where not exists (
  select 1
  from public.employee_rate_history erh
  where erh.employee_id = e.id
);

with month_candidates as (
  select organization_id, extract(year from work_date)::int as year, extract(month from work_date)::int as month
  from public.shifts
  union
  select organization_id, extract(year from payment_date)::int as year, extract(month from payment_date)::int as month
  from public.payments
)
insert into public.schedule_months (organization_id, year, month, status)
select
  mc.organization_id,
  mc.year,
  mc.month,
  case
    when make_date(mc.year, mc.month, 1) < date_trunc('month', current_date)::date then 'approved'
    else 'draft'
  end
from month_candidates mc
where not exists (
  select 1
  from public.schedule_months sm
  where sm.organization_id = mc.organization_id
    and sm.year = mc.year
    and sm.month = mc.month
);

drop trigger if exists schedule_months_set_updated_at on public.schedule_months;
create trigger schedule_months_set_updated_at
before update on public.schedule_months
for each row execute procedure public.set_updated_at();

create or replace function public.append_audit_log(
  organization_id_input uuid,
  actor_user_id_input uuid,
  entity_type_input text,
  entity_id_input uuid,
  action_input text,
  old_value_input jsonb default null,
  new_value_input jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (
    organization_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    old_value,
    new_value
  )
  values (
    organization_id_input,
    actor_user_id_input,
    entity_type_input,
    entity_id_input,
    action_input,
    old_value_input,
    new_value_input
  );
$$;

create or replace function public.owner_user_id_for_org(organization_id_input uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(o.created_by, auth.uid())
  from public.organizations o
  where o.id = organization_id_input
  limit 1
$$;

create or replace function public.ensure_schedule_month_record(year_input integer, month_input integer)
returns public.schedule_months
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  month_row public.schedule_months;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  insert into public.schedule_months (organization_id, year, month, status)
  values (profile_row.organization_id, year_input, month_input, 'draft')
  on conflict (organization_id, year, month) do nothing;

  select sm.* into month_row
  from public.schedule_months sm
  where sm.organization_id = profile_row.organization_id
    and sm.year = year_input
    and sm.month = month_input;

  return month_row;
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
    select 1 from public.profiles p where p.role = 'admin' and p.is_active = true
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

  return jsonb_build_object('email', normalized_email, 'desired_role', normalized_role);
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
  fallback_name text;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.* into existing_profile from public.profiles p where p.id = current_user_id;
  if found then
    return jsonb_build_object('organization_id', existing_profile.organization_id, 'role', existing_profile.role);
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

  select rr.* into request_row
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
    'Employee'
  );

  if request_row.desired_role = 'admin' then
    select p.* into admin_profile
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    if found and admin_profile.id <> current_user_id then
      raise exception 'ADMIN_ALREADY_EXISTS';
    end if;

    select o.* into target_org
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

    insert into public.employees (
      user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
      is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
    )
    values (
      current_user_id, target_org.id, current_user_id, current_user_id, lower(current_user_email), 'active', current_user_id,
      true, current_date, null, fallback_name, 0, false, null
    )
    on conflict do nothing;
  else
    select p.* into admin_profile
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    if not found then
      raise exception 'ADMIN_REQUIRED';
    end if;

    select o.* into target_org
    from public.organizations o
    where o.id = admin_profile.organization_id
    limit 1;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, target_org.id, 'employee', fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = 'employee',
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    select e.* into target_employee
    from public.employees e
    where e.organization_id = target_org.id
      and lower(coalesce(e.work_email, '')) = lower(current_user_email)
    order by e.created_at asc
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
          terminated_at = null,
          updated_at = now()
      where id = target_employee.id;
    else
      insert into public.employees (
        user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
        is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
      )
      values (
        public.owner_user_id_for_org(target_org.id), target_org.id, current_user_id, current_user_id, lower(current_user_email), 'active',
        admin_profile.id, false, current_date, null, fallback_name, 0, false, null
      )
      returning * into target_employee;
    end if;
  end if;

  update public.registration_requests
  set consumed_at = now(),
      consumed_by = current_user_id
  where email = request_row.email;

  select p.* into existing_profile from public.profiles p where p.id = current_user_id;

  perform public.append_audit_log(
    existing_profile.organization_id,
    current_user_id,
    'profile',
    current_user_id,
    'registration_completed',
    null,
    jsonb_build_object('role', existing_profile.role, 'email', lower(current_user_email))
  );

  return jsonb_build_object('organization_id', existing_profile.organization_id, 'role', existing_profile.role);
end;
$$;

create or replace function public.create_employee_record(
  name_input text,
  work_email_input text,
  daily_rate_input integer,
  hired_at_input date default null
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  employee_row public.employees;
  normalized_email text := lower(trim(coalesce(work_email_input, '')));
  normalized_name text := trim(coalesce(name_input, ''));
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if normalized_name = '' then
    raise exception 'EMPLOYEE_NAME_REQUIRED';
  end if;

  if normalized_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if daily_rate_input is null or daily_rate_input < 0 then
    raise exception 'INVALID_RATE';
  end if;

  if exists (
    select 1 from public.employees e
    where e.organization_id = profile_row.organization_id
      and lower(coalesce(e.work_email, '')) = normalized_email
      and e.status <> 'archived'
  ) then
    raise exception 'EMPLOYEE_EMAIL_EXISTS';
  end if;

  insert into public.employees (
    user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
    is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
  )
  values (
    public.owner_user_id_for_org(profile_row.organization_id), profile_row.organization_id, null, null, normalized_email, 'active',
    profile_row.id, false, hired_at_input, null, normalized_name, daily_rate_input, false, null
  )
  returning * into employee_row;

  insert into public.employee_rate_history (
    organization_id, employee_id, rate, valid_from, valid_to, created_by_profile_id
  )
  values (
    profile_row.organization_id, employee_row.id, daily_rate_input, coalesce(hired_at_input, current_date), null, profile_row.id
  )
  on conflict (employee_id, valid_from) do nothing;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'employee', employee_row.id, 'employee_created', null, to_jsonb(employee_row));

  return employee_row;
end;
$$;

create or replace function public.archive_employee_record(employee_id_input uuid)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  previous_row public.employees;
  updated_row public.employees;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select e.* into previous_row
  from public.employees e
  where e.id = employee_id_input
    and e.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if previous_row.is_owner then
    raise exception 'OWNER_EMPLOYEE_CANNOT_BE_ARCHIVED';
  end if;

  update public.employees
  set status = 'archived',
      archived = true,
      archived_at = now(),
      terminated_at = coalesce(previous_row.terminated_at, current_date),
      updated_at = now()
  where id = previous_row.id
  returning * into updated_row;

  update public.employee_rate_history
  set valid_to = coalesce(valid_to, coalesce(updated_row.terminated_at, current_date))
  where employee_id = updated_row.id
    and valid_to is null;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'employee', updated_row.id, 'employee_archived', to_jsonb(previous_row), to_jsonb(updated_row));

  return updated_row;
end;
$$;

create or replace function public.update_employee_rate_record(
  employee_id_input uuid,
  daily_rate_input integer,
  valid_from_input date default current_date
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  previous_row public.employees;
  updated_row public.employees;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if daily_rate_input is null or daily_rate_input < 0 then
    raise exception 'INVALID_RATE';
  end if;

  select e.* into previous_row
  from public.employees e
  where e.id = employee_id_input
    and e.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  update public.employee_rate_history
  set valid_to = valid_from_input - 1
  where employee_id = employee_id_input
    and valid_from < valid_from_input
    and (valid_to is null or valid_to >= valid_from_input);

  delete from public.employee_rate_history
  where employee_id = employee_id_input
    and valid_from = valid_from_input;

  insert into public.employee_rate_history (
    organization_id, employee_id, rate, valid_from, valid_to, created_by_profile_id
  )
  values (
    profile_row.organization_id, employee_id_input, daily_rate_input, valid_from_input, null, profile_row.id
  );

  update public.employees
  set daily_rate = daily_rate_input,
      updated_at = now()
  where id = employee_id_input
  returning * into updated_row;

  perform public.append_audit_log(
    profile_row.organization_id,
    auth.uid(),
    'employee_rate',
    employee_id_input,
    'employee_rate_updated',
    jsonb_build_object('previous_rate', previous_row.daily_rate),
    jsonb_build_object('rate', daily_rate_input, 'valid_from', valid_from_input)
  );

  return updated_row;
end;
$$;

create or replace function public.upsert_shift_entry(
  employee_id_input uuid,
  work_date_input date,
  status_input text
)
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  employee_row public.employees;
  month_row public.schedule_months;
  existing_row public.shifts;
  updated_row public.shifts;
  effective_rate integer;
  normalized_status text := lower(trim(coalesce(status_input, '')));
begin
  if normalized_status not in ('shift', 'day_off', 'sick_leave', 'no_show', 'replacement', 'no_shift') then
    raise exception 'INVALID_SHIFT_STATUS';
  end if;

  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select e.* into employee_row
  from public.employees e
  where e.id = employee_id_input
    and e.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if profile_row.role = 'employee' and employee_row.profile_id <> auth.uid() then
    raise exception 'PERMISSION_DENIED';
  end if;

  if employee_row.hired_at is not null and work_date_input < employee_row.hired_at then
    raise exception 'EMPLOYEE_OUTSIDE_EMPLOYMENT_WINDOW';
  end if;

  if employee_row.terminated_at is not null and work_date_input > employee_row.terminated_at then
    raise exception 'EMPLOYEE_OUTSIDE_EMPLOYMENT_WINDOW';
  end if;

  month_row := public.ensure_schedule_month_record(extract(year from work_date_input)::int, extract(month from work_date_input)::int);
  if profile_row.role = 'employee' and month_row.status <> 'draft' then
    raise exception 'MONTH_LOCKED';
  end if;
  if profile_row.role = 'admin' and month_row.status = 'closed' then
    raise exception 'MONTH_LOCKED';
  end if;

  select erh.rate into effective_rate
  from public.employee_rate_history erh
  where erh.employee_id = employee_row.id
    and erh.valid_from <= work_date_input
    and (erh.valid_to is null or erh.valid_to >= work_date_input)
  order by erh.valid_from desc
  limit 1;
  effective_rate := coalesce(effective_rate, employee_row.daily_rate, 0);

  select s.* into existing_row
  from public.shifts s
  where s.organization_id = profile_row.organization_id
    and s.employee_id = employee_id_input
    and s.work_date = work_date_input
  for update;

  if not found then
    insert into public.shifts (
      user_id, organization_id, employee_id, work_date, status, requested_status, approved_status, actual_status,
      rate_snapshot, created_by_profile_id, requested_by_profile_id, approved_by_profile_id, actual_by_profile_id
    )
    values (
      public.owner_user_id_for_org(profile_row.organization_id), profile_row.organization_id, employee_id_input, work_date_input, normalized_status,
      case when profile_row.role = 'employee' then normalized_status else null end,
      case when profile_row.role = 'admin' then normalized_status else null end,
      null,
      effective_rate, profile_row.id,
      case when profile_row.role = 'employee' then profile_row.id else null end,
      case when profile_row.role = 'admin' then profile_row.id else null end,
      null
    )
    returning * into updated_row;
  else
    update public.shifts
    set requested_status = case when profile_row.role = 'employee' then normalized_status else requested_status end,
        approved_status = case when profile_row.role = 'admin' then normalized_status else approved_status end,
        requested_by_profile_id = case when profile_row.role = 'employee' then profile_row.id else requested_by_profile_id end,
        approved_by_profile_id = case when profile_row.role = 'admin' then profile_row.id else approved_by_profile_id end,
        status = coalesce(actual_status, case when profile_row.role = 'admin' then normalized_status else approved_status end, case when profile_row.role = 'employee' then normalized_status else requested_status end, normalized_status),
        rate_snapshot = effective_rate,
        updated_at = now()
    where id = existing_row.id
    returning * into updated_row;
  end if;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'shift', updated_row.id, 'shift_saved', case when found then to_jsonb(existing_row) else null end, to_jsonb(updated_row));

  return updated_row;
end;
$$;

create or replace function public.delete_shift_entry(
  employee_id_input uuid,
  work_date_input date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  month_row public.schedule_months;
  existing_row public.shifts;
  updated_row public.shifts;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  month_row := public.ensure_schedule_month_record(extract(year from work_date_input)::int, extract(month from work_date_input)::int);
  if profile_row.role = 'employee' and month_row.status <> 'draft' then
    raise exception 'MONTH_LOCKED';
  end if;
  if profile_row.role = 'admin' and month_row.status = 'closed' then
    raise exception 'MONTH_LOCKED';
  end if;

  select s.* into existing_row
  from public.shifts s
  where s.organization_id = profile_row.organization_id
    and s.employee_id = employee_id_input
    and s.work_date = work_date_input
  for update;

  if not found then
    return jsonb_build_object('deleted', false);
  end if;

  if profile_row.role = 'employee' and existing_row.employee_id <> public.my_employee_id() then
    raise exception 'PERMISSION_DENIED';
  end if;

  update public.shifts
  set requested_status = case when profile_row.role = 'employee' then null else requested_status end,
      approved_status = case when profile_row.role = 'admin' then null else approved_status end,
      requested_by_profile_id = case when profile_row.role = 'employee' then null else requested_by_profile_id end,
      approved_by_profile_id = case when profile_row.role = 'admin' then null else approved_by_profile_id end,
      status = coalesce(actual_status, case when profile_row.role = 'admin' then null else approved_status end, case when profile_row.role = 'employee' then null else requested_status end, 'no_shift'),
      updated_at = now()
  where id = existing_row.id
  returning * into updated_row;

  if updated_row.requested_status is null and updated_row.approved_status is null and updated_row.actual_status is null then
    delete from public.shifts where id = updated_row.id;
    perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'shift', existing_row.id, 'shift_deleted', to_jsonb(existing_row), null);
    return jsonb_build_object('deleted', true);
  end if;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'shift', updated_row.id, 'shift_cleared', to_jsonb(existing_row), to_jsonb(updated_row));
  return jsonb_build_object('deleted', false);
end;
$$;

create or replace function public.create_payment_record(
  employee_id_input uuid,
  amount_input integer,
  payment_date_input date,
  comment_input text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  employee_row public.employees;
  payment_row public.payments;
  next_status text;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  if amount_input is null or amount_input <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  select e.* into employee_row
  from public.employees e
  where e.id = employee_id_input
    and e.organization_id = profile_row.organization_id;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if profile_row.role = 'employee' and employee_row.profile_id <> auth.uid() then
    raise exception 'PERMISSION_DENIED';
  end if;

  next_status := case when profile_row.role = 'admin' then 'approved' else 'pending' end;

  insert into public.payments (
    user_id, organization_id, employee_id, amount, payment_date, comment, status,
    requested_by_auth_user_id, approved_by_auth_user_id, requested_by_profile_id, approved_by_profile_id,
    approved_at, edited_by_admin
  )
  values (
    public.owner_user_id_for_org(profile_row.organization_id), profile_row.organization_id, employee_id_input, amount_input, payment_date_input,
    coalesce(comment_input, ''), next_status, auth.uid(), case when profile_row.role = 'admin' then auth.uid() else null end,
    profile_row.id, case when profile_row.role = 'admin' then profile_row.id else null end,
    case when profile_row.role = 'admin' then now() else null end, false
  )
  returning * into payment_row;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'payment', payment_row.id, 'payment_created', null, to_jsonb(payment_row));

  return payment_row;
end;
$$;

create or replace function public.update_payment_record(
  payment_id_input uuid,
  amount_input integer default null,
  payment_date_input date default null,
  comment_input text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  existing_row public.payments;
  updated_row public.payments;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select p.* into existing_row
  from public.payments p
  where p.id = payment_id_input
    and p.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if profile_row.role <> 'admin' and (existing_row.employee_id <> public.my_employee_id() or existing_row.status <> 'pending') then
    raise exception 'PERMISSION_DENIED';
  end if;

  if amount_input is not null and amount_input <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  update public.payments
  set amount = coalesce(amount_input, existing_row.amount),
      payment_date = coalesce(payment_date_input, existing_row.payment_date),
      comment = coalesce(comment_input, existing_row.comment),
      edited_by_admin = case when profile_row.role = 'admin' then true else edited_by_admin end,
      updated_at = now()
  where id = existing_row.id
  returning * into updated_row;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'payment', updated_row.id, 'payment_updated', to_jsonb(existing_row), to_jsonb(updated_row));

  return updated_row;
end;
$$;

create or replace function public.approve_payment_record(payment_id_input uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  existing_row public.payments;
  updated_row public.payments;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select p.* into existing_row
  from public.payments p
  where p.id = payment_id_input
    and p.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if existing_row.status <> 'pending' then
    raise exception 'PAYMENT_STATUS_INVALID';
  end if;

  update public.payments
  set status = 'approved',
      approved_by_auth_user_id = auth.uid(),
      approved_by_profile_id = profile_row.id,
      approved_at = now(),
      updated_at = now()
  where id = existing_row.id
  returning * into updated_row;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'payment', updated_row.id, 'payment_approved', to_jsonb(existing_row), to_jsonb(updated_row));
  return updated_row;
end;
$$;

create or replace function public.reject_payment_record(payment_id_input uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  existing_row public.payments;
  updated_row public.payments;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select p.* into existing_row
  from public.payments p
  where p.id = payment_id_input
    and p.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if existing_row.status <> 'pending' then
    raise exception 'PAYMENT_STATUS_INVALID';
  end if;

  update public.payments
  set status = 'rejected',
      approved_by_auth_user_id = null,
      approved_by_profile_id = null,
      approved_at = null,
      updated_at = now()
  where id = existing_row.id
  returning * into updated_row;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'payment', updated_row.id, 'payment_rejected', to_jsonb(existing_row), to_jsonb(updated_row));
  return updated_row;
end;
$$;

create or replace function public.delete_payment_record(payment_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  existing_row public.payments;
begin
  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select p.* into existing_row
  from public.payments p
  where p.id = payment_id_input
    and p.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if profile_row.role = 'admin' then
    if existing_row.status = 'approved' then
      raise exception 'APPROVED_PAYMENT_CANNOT_BE_DELETED';
    end if;
  elsif existing_row.employee_id <> public.my_employee_id() or existing_row.status <> 'pending' then
    raise exception 'PERMISSION_DENIED';
  end if;

  delete from public.payments where id = existing_row.id;
  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'payment', existing_row.id, 'payment_deleted', to_jsonb(existing_row), null);
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.set_schedule_month_status(year_input integer, month_input integer, status_input text)
returns public.schedule_months
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  current_row public.schedule_months;
  updated_row public.schedule_months;
  month_start date := make_date(year_input, month_input, 1);
  month_end date := (make_date(year_input, month_input, 1) + interval '1 month - 1 day')::date;
  has_empty_days boolean;
begin
  if status_input not in ('draft', 'pending_approval', 'approved', 'closed') then
    raise exception 'INVALID_MONTH_STATUS';
  end if;

  select p.* into profile_row from public.profiles p where p.id = auth.uid();
  if not found or profile_row.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  current_row := public.ensure_schedule_month_record(year_input, month_input);

  if current_row.status = 'closed' and status_input <> 'closed' then
    raise exception 'MONTH_LOCKED';
  end if;

  if status_input = 'closed' and current_row.status <> 'approved' then
    raise exception 'MONTH_MUST_BE_APPROVED_FIRST';
  end if;

  if status_input in ('approved', 'closed') then
    select exists (
      select 1
      from generate_series(month_start, month_end, interval '1 day') as day_value
      where not exists (
        select 1
        from public.shifts s
        where s.organization_id = profile_row.organization_id
          and s.work_date = day_value::date
          and coalesce(s.approved_status, s.status) in ('shift', 'replacement')
      )
    ) into has_empty_days;

    if has_empty_days then
      raise exception 'MONTH_HAS_EMPTY_DAYS';
    end if;
  end if;

  update public.schedule_months
  set status = status_input,
      approved_by_profile_id = case when status_input = 'approved' then profile_row.id else approved_by_profile_id end,
      approved_at = case when status_input = 'approved' then now() else approved_at end,
      closed_by_profile_id = case when status_input = 'closed' then profile_row.id else closed_by_profile_id end,
      closed_at = case when status_input = 'closed' then now() else closed_at end,
      updated_at = now()
  where id = current_row.id
  returning * into updated_row;

  perform public.append_audit_log(profile_row.organization_id, auth.uid(), 'schedule_month', updated_row.id, 'month_status_updated', to_jsonb(current_row), to_jsonb(updated_row));
  return updated_row;
end;
$$;

grant execute on function public.owner_user_id_for_org(uuid) to authenticated;
grant execute on function public.ensure_schedule_month_record(integer, integer) to authenticated;
grant execute on function public.request_registration(text, text, text) to anon;
grant execute on function public.request_registration(text, text, text) to authenticated;
grant execute on function public.ensure_profile_from_registration() to authenticated;
grant execute on function public.create_employee_record(text, text, integer, date) to authenticated;
grant execute on function public.archive_employee_record(uuid) to authenticated;
grant execute on function public.update_employee_rate_record(uuid, integer, date) to authenticated;
grant execute on function public.upsert_shift_entry(uuid, date, text) to authenticated;
grant execute on function public.delete_shift_entry(uuid, date) to authenticated;
grant execute on function public.create_payment_record(uuid, integer, date, text) to authenticated;
grant execute on function public.update_payment_record(uuid, integer, date, text) to authenticated;
grant execute on function public.approve_payment_record(uuid) to authenticated;
grant execute on function public.reject_payment_record(uuid) to authenticated;
grant execute on function public.delete_payment_record(uuid) to authenticated;
grant execute on function public.set_schedule_month_status(integer, integer, text) to authenticated;

drop function if exists public.activate_employee_account();
drop function if exists public.bootstrap_admin_account(text, text);

alter table public.employee_rate_history enable row level security;
alter table public.schedule_months enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "employee_rate_history_select_scoped" on public.employee_rate_history;
drop policy if exists "employee_rate_history_admin_write" on public.employee_rate_history;
drop policy if exists "schedule_months_select_scoped" on public.schedule_months;
drop policy if exists "schedule_months_admin_write" on public.schedule_months;
drop policy if exists "audit_log_select_admin" on public.audit_log;

create policy "employee_rate_history_select_scoped" on public.employee_rate_history
for select
using (organization_id = public.current_organization_id());

create policy "employee_rate_history_admin_write" on public.employee_rate_history
for all
using (public.is_admin() and organization_id = public.current_organization_id())
with check (public.is_admin() and organization_id = public.current_organization_id());

create policy "schedule_months_select_scoped" on public.schedule_months
for select
using (organization_id = public.current_organization_id());

create policy "schedule_months_admin_write" on public.schedule_months
for all
using (public.is_admin() and organization_id = public.current_organization_id())
with check (public.is_admin() and organization_id = public.current_organization_id());

create policy "audit_log_select_admin" on public.audit_log
for select
using (public.is_admin() and organization_id = public.current_organization_id());

commit;
