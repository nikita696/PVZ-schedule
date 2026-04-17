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
    '���������'
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

