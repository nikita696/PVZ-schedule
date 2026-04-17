begin;

create or replace function public.sync_profile_membership(profile_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
  admin_profile public.profiles;
  target_employee public.employees;
  current_user_email text;
  fallback_name text;
  owner_user_id uuid;
begin
  if profile_id_input is null then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select p.* into profile_row
  from public.profiles p
  where p.id = profile_id_input;

  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select lower(nullif(trim(au.email), ''))
  into current_user_email
  from auth.users au
  where au.id = profile_row.id;

  fallback_name := coalesce(
    nullif(trim(profile_row.display_name), ''),
    nullif(split_part(coalesce(current_user_email, ''), '@', 1), ''),
    case when profile_row.role = 'admin' then 'Admin' else 'Employee' end
  );

  if profile_row.role = 'admin' then
    select e.* into target_employee
    from public.employees e
    where e.organization_id = profile_row.organization_id
      and (
        e.profile_id = profile_row.id
        or e.auth_user_id = profile_row.id
        or (current_user_email is not null and lower(coalesce(e.work_email, '')) = current_user_email)
      )
    order by
      case
        when e.is_owner and e.profile_id = profile_row.id then 0
        when e.profile_id = profile_row.id then 1
        when e.auth_user_id = profile_row.id then 2
        when current_user_email is not null and lower(coalesce(e.work_email, '')) = current_user_email then 3
        else 4
      end,
      e.created_at asc
    limit 1
    for update;

    if found then
      update public.employees
      set user_id = profile_row.id,
          profile_id = profile_row.id,
          auth_user_id = profile_row.id,
          work_email = coalesce(current_user_email, work_email),
          status = 'active',
          archived = false,
          archived_at = null,
          is_owner = true,
          hired_at = coalesce(hired_at, current_date),
          terminated_at = null,
          name = coalesce(nullif(trim(name), ''), fallback_name),
          created_by_profile_id = coalesce(created_by_profile_id, profile_row.id),
          updated_at = now()
      where id = target_employee.id
      returning * into target_employee;
    else
      insert into public.employees (
        user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
        is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
      )
      values (
        profile_row.id,
        profile_row.organization_id,
        profile_row.id,
        profile_row.id,
        current_user_email,
        'active',
        profile_row.id,
        true,
        current_date,
        null,
        fallback_name,
        0,
        false,
        null
      )
      returning * into target_employee;
    end if;
  else
    select p.* into admin_profile
    from public.profiles p
    where p.organization_id = profile_row.organization_id
      and p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    owner_user_id := coalesce(public.owner_user_id_for_org(profile_row.organization_id), admin_profile.id, profile_row.id);

    select e.* into target_employee
    from public.employees e
    where e.organization_id = profile_row.organization_id
      and e.status <> 'archived'
      and (
        e.profile_id = profile_row.id
        or e.auth_user_id = profile_row.id
        or (current_user_email is not null and lower(coalesce(e.work_email, '')) = current_user_email)
      )
    order by
      case
        when e.profile_id = profile_row.id then 0
        when e.auth_user_id = profile_row.id then 1
        when current_user_email is not null and lower(coalesce(e.work_email, '')) = current_user_email then 2
        else 3
      end,
      e.created_at asc
    limit 1
    for update;

    if found then
      update public.employees
      set user_id = coalesce(user_id, owner_user_id),
          profile_id = profile_row.id,
          auth_user_id = profile_row.id,
          work_email = coalesce(current_user_email, work_email),
          status = 'active',
          archived = false,
          archived_at = null,
          is_owner = false,
          hired_at = coalesce(hired_at, current_date),
          terminated_at = null,
          name = coalesce(nullif(trim(name), ''), fallback_name),
          created_by_profile_id = coalesce(created_by_profile_id, admin_profile.id, profile_row.id),
          updated_at = now()
      where id = target_employee.id
      returning * into target_employee;
    else
      insert into public.employees (
        user_id, organization_id, profile_id, auth_user_id, work_email, status, created_by_profile_id,
        is_owner, hired_at, terminated_at, name, daily_rate, archived, archived_at
      )
      values (
        owner_user_id,
        profile_row.organization_id,
        profile_row.id,
        profile_row.id,
        current_user_email,
        'active',
        coalesce(admin_profile.id, profile_row.id),
        false,
        current_date,
        null,
        fallback_name,
        0,
        false,
        null
      )
      returning * into target_employee;
    end if;
  end if;

  return jsonb_build_object(
    'profile_id', profile_row.id,
    'employee_id', target_employee.id,
    'organization_id', profile_row.organization_id,
    'role', profile_row.role
  );
end;
$$;

create or replace function public.ensure_profile_membership()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return public.sync_profile_membership(auth.uid());
end;
$$;

grant execute on function public.ensure_profile_membership() to authenticated;

do $$
declare
  profile_record record;
begin
  for profile_record in
    select p.id
    from public.profiles p
    where p.is_active = true
      and p.role in ('admin', 'employee')
  loop
    perform public.sync_profile_membership(profile_record.id);
  end loop;
end;
$$;

commit;
