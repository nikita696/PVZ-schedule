begin;

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
  request_found boolean := false;
  admin_profile public.profiles;
  target_org public.organizations;
  target_employee public.employees;
  fallback_name text;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
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

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  select rr.* into request_row
  from public.registration_requests rr
  where rr.email = lower(current_user_email)
  limit 1
  for update;

  request_found := found;

  if existing_profile.id is not null and existing_profile.is_active then
    if request_found then
      update public.registration_requests
      set consumed_at = coalesce(consumed_at, now()),
          consumed_by = coalesce(consumed_by, current_user_id)
      where email = request_row.email;
    end if;

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  if not request_found then
    if existing_profile.id is not null and not existing_profile.is_active then
      raise exception 'PROFILE_DISABLED';
    end if;

    raise exception 'REGISTRATION_NOT_FOUND';
  end if;

  fallback_name := coalesce(
    nullif(trim(request_row.display_name), ''),
    nullif(trim(existing_profile.display_name), ''),
    nullif(split_part(current_user_email, '@', 1), ''),
    case when request_row.desired_role = 'admin' then 'Администратор' else 'Сотрудник' end
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

    select e.* into target_employee
    from public.employees e
    where e.organization_id = target_org.id
      and (
        e.profile_id = current_user_id
        or e.auth_user_id = current_user_id
        or lower(coalesce(e.work_email, '')) = lower(current_user_email)
      )
    order by e.created_at asc
    limit 1
    for update;

    if found then
      update public.employees
      set user_id = current_user_id,
          profile_id = current_user_id,
          auth_user_id = current_user_id,
          work_email = lower(current_user_email),
          status = 'active',
          archived = false,
          archived_at = null,
          is_owner = true,
          hired_at = coalesce(hired_at, current_date),
          terminated_at = null,
          name = coalesce(nullif(trim(name), ''), fallback_name),
          created_by_profile_id = coalesce(created_by_profile_id, current_user_id),
          updated_at = now()
      where id = target_employee.id
      returning * into target_employee;
    else
      insert into public.employees (
        user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
        is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
      )
      values (
        current_user_id, target_org.id, current_user_id, current_user_id, lower(current_user_email), 'active',
        current_user_id, true, current_date, null, fallback_name, 0, false, null
      )
      returning * into target_employee;
    end if;
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
      and e.status <> 'archived'
      and (
        e.profile_id = current_user_id
        or e.auth_user_id = current_user_id
        or lower(coalesce(e.work_email, '')) = lower(current_user_email)
      )
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
          is_owner = false,
          hired_at = coalesce(hired_at, current_date),
          terminated_at = null,
          name = coalesce(nullif(trim(name), ''), fallback_name),
          updated_at = now()
      where id = target_employee.id
      returning * into target_employee;
    else
      insert into public.employees (
        user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
        is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
      )
      values (
        public.owner_user_id_for_org(target_org.id), target_org.id, current_user_id, current_user_id,
        lower(current_user_email), 'active', admin_profile.id, false, current_date, null,
        fallback_name, 0, false, null
      )
      returning * into target_employee;
    end if;
  end if;

  update public.registration_requests
  set consumed_at = now(),
      consumed_by = current_user_id
  where email = request_row.email;

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  perform public.append_audit_log(
    existing_profile.organization_id,
    current_user_id,
    'profile',
    current_user_id,
    'registration_completed',
    null,
    jsonb_build_object('role', existing_profile.role, 'email', lower(current_user_email))
  );

  return jsonb_build_object(
    'organization_id', existing_profile.organization_id,
    'role', existing_profile.role
  );
end;
$$;

commit;
