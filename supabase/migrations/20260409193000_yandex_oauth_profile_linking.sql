begin;

create or replace function public.ensure_profile_from_auth(
  desired_role_input text default null,
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
  email_matched_profile public.profiles;
  request_row public.registration_requests;
  request_found boolean := false;
  admin_profile public.profiles;
  target_org public.organizations;
  target_employee public.employees;
  resolved_role text;
  fallback_name text;
  linked_employee_role text;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select lower(nullif(trim(au.email), ''))
  into current_user_email
  from auth.users au
  where au.id = current_user_id;

  if current_user_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if found and existing_profile.is_active then
    perform public.sync_profile_membership(current_user_id);

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  select rr.* into request_row
  from public.registration_requests rr
  where rr.email = current_user_email
  limit 1
  for update;

  request_found := found;

  select p.* into email_matched_profile
  from public.profiles p
  join auth.users au on au.id = p.id
  where lower(coalesce(au.email, '')) = current_user_email
    and p.id <> current_user_id
  order by
    case when p.is_active then 0 else 1 end,
    case when p.role = 'admin' then 0 else 1 end,
    p.created_at asc
  limit 1
  for update of p;

  if found then
    resolved_role := email_matched_profile.role;
    fallback_name := coalesce(
      nullif(trim(display_name_input), ''),
      nullif(trim(email_matched_profile.display_name), ''),
      nullif(split_part(current_user_email, '@', 1), ''),
      case when resolved_role = 'admin' then 'Администратор' else 'Сотрудник' end
    );

    if resolved_role = 'admin' then
      update public.organizations
      set created_by = current_user_id,
          updated_at = now()
      where id = email_matched_profile.organization_id
        and coalesce(created_by, email_matched_profile.id) = email_matched_profile.id;
    end if;

    update public.profiles
    set is_active = false,
        updated_at = now()
    where id = email_matched_profile.id
      and id <> current_user_id;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, email_matched_profile.organization_id, resolved_role, fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    perform public.sync_profile_membership(current_user_id);

    if request_found then
      update public.registration_requests
      set consumed_at = now(),
          consumed_by = current_user_id
      where email = request_row.email;
    end if;

    select p.* into existing_profile
    from public.profiles p
    where p.id = current_user_id;

    perform public.append_audit_log(
      existing_profile.organization_id,
      current_user_id,
      'profile',
      current_user_id,
      'oauth_identity_linked',
      jsonb_build_object('legacy_profile_id', email_matched_profile.id),
      jsonb_build_object('role', existing_profile.role, 'email', current_user_email)
    );

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  select e.* into target_employee
  from public.employees e
  where lower(coalesce(e.work_email, '')) = current_user_email
    and e.archived = false
  order by
    case when e.is_owner then 0 else 1 end,
    case when e.status = 'active' then 0 else 1 end,
    e.created_at asc
  limit 1
  for update;

  if found then
    select o.* into target_org
    from public.organizations o
    where o.id = target_employee.organization_id;

    select p.role into linked_employee_role
    from public.profiles p
    where p.id = target_employee.profile_id;

    select p.* into admin_profile
    from public.profiles p
    where p.organization_id = target_employee.organization_id
      and p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    resolved_role := case
      when target_employee.is_owner then 'admin'
      when linked_employee_role = 'admin' then 'admin'
      else 'employee'
    end;

    if resolved_role = 'admin'
      and admin_profile.id is not null
      and admin_profile.id <> current_user_id
      and admin_profile.id <> target_employee.profile_id then
      raise exception 'ADMIN_ALREADY_EXISTS';
    end if;

    fallback_name := coalesce(
      nullif(trim(display_name_input), ''),
      nullif(trim(target_employee.name), ''),
      nullif(split_part(current_user_email, '@', 1), ''),
      case when resolved_role = 'admin' then 'Администратор' else 'Сотрудник' end
    );

    if target_employee.profile_id is not null and target_employee.profile_id <> current_user_id then
      update public.profiles
      set is_active = false,
          updated_at = now()
      where id = target_employee.profile_id;
    end if;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, target_org.id, resolved_role, fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    if resolved_role = 'admin' then
      update public.organizations
      set created_by = current_user_id,
          updated_at = now()
      where id = target_org.id;
    end if;

    update public.employees
    set user_id = case
          when resolved_role = 'admin' then current_user_id
          else coalesce(user_id, public.owner_user_id_for_org(target_org.id), current_user_id)
        end,
        profile_id = current_user_id,
        auth_user_id = current_user_id,
        work_email = current_user_email,
        status = 'active',
        archived = false,
        archived_at = null,
        is_owner = (resolved_role = 'admin'),
        hired_at = coalesce(hired_at, current_date),
        terminated_at = null,
        name = coalesce(nullif(trim(name), ''), fallback_name),
        created_by_profile_id = coalesce(created_by_profile_id, admin_profile.id, current_user_id),
        updated_at = now()
    where id = target_employee.id
    returning * into target_employee;

    perform public.sync_profile_membership(current_user_id);

    if request_found then
      update public.registration_requests
      set consumed_at = now(),
          consumed_by = current_user_id
      where email = request_row.email;
    end if;

    select p.* into existing_profile
    from public.profiles p
    where p.id = current_user_id;

    perform public.append_audit_log(
      existing_profile.organization_id,
      current_user_id,
      'profile',
      current_user_id,
      'oauth_employee_linked',
      jsonb_build_object('employee_id', target_employee.id),
      jsonb_build_object('role', existing_profile.role, 'email', current_user_email)
    );

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  resolved_role := lower(trim(coalesce(
    desired_role_input,
    case when request_found then request_row.desired_role else null end,
    ''
  )));

  if resolved_role not in ('admin', 'employee') then
    raise exception 'REGISTRATION_REQUIRED';
  end if;

  fallback_name := coalesce(
    nullif(trim(display_name_input), ''),
    nullif(trim(case when request_found then request_row.display_name else null end), ''),
    nullif(split_part(current_user_email, '@', 1), ''),
    case when resolved_role = 'admin' then 'Администратор' else 'Сотрудник' end
  );

  if resolved_role = 'admin' then
    select p.* into admin_profile
    from public.profiles p
    where p.role = 'admin'
      and p.is_active = true
      and p.id <> current_user_id
    order by p.created_at asc
    limit 1;

    if found then
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

    update public.organizations
    set created_by = current_user_id,
        updated_at = now()
    where id = target_org.id;
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
  end if;

  perform public.sync_profile_membership(current_user_id);

  if request_found then
    update public.registration_requests
    set consumed_at = now(),
        consumed_by = current_user_id
    where email = request_row.email;
  end if;

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  perform public.append_audit_log(
    existing_profile.organization_id,
    current_user_id,
    'profile',
    current_user_id,
    'oauth_registration_completed',
    null,
    jsonb_build_object('role', existing_profile.role, 'email', current_user_email)
  );

  return jsonb_build_object(
    'organization_id', existing_profile.organization_id,
    'role', existing_profile.role
  );
end;
$$;

create or replace function public.ensure_profile_from_registration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ensure_profile_from_auth(null, null);
end;
$$;

grant execute on function public.ensure_profile_from_auth(text, text) to authenticated;
grant execute on function public.ensure_profile_from_registration() to authenticated;

commit;
