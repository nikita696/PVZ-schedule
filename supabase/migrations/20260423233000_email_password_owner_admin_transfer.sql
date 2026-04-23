begin;

create table if not exists public.owner_admin_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_email text not null,
  target_display_name text not null default 'Татьяна',
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  source_admin_profile_id uuid not null references public.profiles(id) on delete restrict,
  claimed_by_profile_id uuid null references public.profiles(id) on delete set null,
  claimed_by_auth_user_id uuid null references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz null,
  cancelled_at timestamptz null,
  notes text null
);

create index if not exists owner_admin_claims_org_requested_at_idx
  on public.owner_admin_claims (organization_id, requested_at desc);

create unique index if not exists owner_admin_claims_one_pending_org_uidx
  on public.owner_admin_claims (organization_id)
  where status = 'pending';

create unique index if not exists owner_admin_claims_target_email_pending_uidx
  on public.owner_admin_claims ((lower(target_email)))
  where status = 'pending';

create unique index if not exists profiles_single_active_admin_uidx
  on public.profiles ((1))
  where role = 'admin' and is_active = true;

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
    and p.is_active = true
  limit 1
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

create or replace function public.ensure_profile_from_session(
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
  current_user_confirmed_at timestamptz;
  metadata_display_name text;
  existing_profile public.profiles;
  email_matched_profile public.profiles;
  request_row public.registration_requests;
  admin_profile public.profiles;
  target_org public.organizations;
  target_employee public.employees;
  owner_user_id uuid;
  fallback_name text;
  pending_claim_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    lower(nullif(trim(au.email), '')),
    au.email_confirmed_at,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), '')
    )
  into current_user_email, current_user_confirmed_at, metadata_display_name
  from auth.users au
  where au.id = current_user_id;

  if current_user_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if current_user_confirmed_at is null then
    raise exception 'EMAIL_NOT_CONFIRMED';
  end if;

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id
  for update;

  if found then
    if not existing_profile.is_active then
      raise exception 'PROFILE_DISABLED';
    end if;

    perform public.sync_profile_membership(current_user_id);

    select p.* into existing_profile
    from public.profiles p
    where p.id = current_user_id;

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  select c.id into pending_claim_id
  from public.owner_admin_claims c
  where lower(c.target_email) = current_user_email
    and c.status = 'pending'
  order by c.requested_at asc
  limit 1;

  if found then
    raise exception 'OWNER_ADMIN_CLAIM_REQUIRED';
  end if;

  select p.* into email_matched_profile
  from public.profiles p
  join auth.users au on au.id = p.id
  where lower(coalesce(au.email, '')) = current_user_email
    and p.id <> current_user_id
  order by
    case when p.is_active then 0 else 1 end,
    p.created_at asc
  limit 1
  for update of p;

  if found then
    if email_matched_profile.role = 'admin' then
      raise exception 'OWNER_ADMIN_CLAIM_REQUIRED';
    end if;

    fallback_name := coalesce(
      nullif(trim(display_name_input), ''),
      metadata_display_name,
      nullif(trim(email_matched_profile.display_name), ''),
      nullif(split_part(current_user_email, '@', 1), ''),
      'Employee'
    );

    update public.profiles
    set is_active = false,
        updated_at = now()
    where id = email_matched_profile.id
      and id <> current_user_id;

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, email_matched_profile.organization_id, 'employee', fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = 'employee',
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    update public.employees
    set profile_id = current_user_id,
        auth_user_id = current_user_id,
        work_email = current_user_email,
        status = 'active',
        archived = false,
        archived_at = null,
        is_owner = false,
        terminated_at = null,
        updated_at = now()
    where organization_id = email_matched_profile.organization_id
      and status <> 'archived'
      and (
        profile_id = email_matched_profile.id
        or auth_user_id = email_matched_profile.id
        or lower(coalesce(work_email, '')) = current_user_email
      );

    perform public.sync_profile_membership(current_user_id);

    select p.* into existing_profile
    from public.profiles p
    where p.id = current_user_id;

    perform public.append_audit_log(
      existing_profile.organization_id,
      current_user_id,
      'profile',
      current_user_id,
      'session_identity_linked',
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
    and e.status <> 'archived'
  order by
    case when e.profile_id is null and e.auth_user_id is null then 0 else 1 end,
    e.created_at asc
  limit 1
  for update;

  if found then
    if target_employee.is_owner then
      raise exception 'OWNER_ADMIN_CLAIM_REQUIRED';
    end if;

    if target_employee.profile_id is not null and target_employee.profile_id <> current_user_id then
      raise exception 'EMPLOYEE_ALREADY_LINKED';
    end if;

    select p.* into admin_profile
    from public.profiles p
    where p.organization_id = target_employee.organization_id
      and p.role = 'admin'
      and p.is_active = true
    order by p.created_at asc
    limit 1;

    if not found then
      raise exception 'ADMIN_REQUIRED';
    end if;

    fallback_name := coalesce(
      nullif(trim(display_name_input), ''),
      metadata_display_name,
      nullif(trim(target_employee.name), ''),
      nullif(split_part(current_user_email, '@', 1), ''),
      'Employee'
    );

    insert into public.profiles (id, organization_id, role, display_name, is_active)
    values (current_user_id, target_employee.organization_id, 'employee', fallback_name, true)
    on conflict (id) do update
    set organization_id = excluded.organization_id,
        role = 'employee',
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    update public.employees
    set profile_id = current_user_id,
        auth_user_id = current_user_id,
        work_email = current_user_email,
        status = 'active',
        archived = false,
        archived_at = null,
        is_owner = false,
        hired_at = coalesce(hired_at, current_date),
        terminated_at = null,
        name = coalesce(nullif(trim(name), ''), fallback_name),
        created_by_profile_id = coalesce(created_by_profile_id, admin_profile.id, current_user_id),
        updated_at = now()
    where id = target_employee.id
    returning * into target_employee;

    perform public.sync_profile_membership(current_user_id);

    select p.* into existing_profile
    from public.profiles p
    where p.id = current_user_id;

    perform public.append_audit_log(
      existing_profile.organization_id,
      current_user_id,
      'profile',
      current_user_id,
      'session_employee_linked',
      jsonb_build_object('employee_id', target_employee.id),
      jsonb_build_object('role', existing_profile.role, 'email', current_user_email)
    );

    return jsonb_build_object(
      'organization_id', existing_profile.organization_id,
      'role', existing_profile.role
    );
  end if;

  select rr.* into request_row
  from public.registration_requests rr
  where rr.email = current_user_email
    and rr.consumed_at is null
  limit 1
  for update;

  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;

  if request_row.desired_role = 'admin' then
    raise exception 'OWNER_ADMIN_CLAIM_REQUIRED';
  end if;

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

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  fallback_name := coalesce(
    nullif(trim(display_name_input), ''),
    metadata_display_name,
    nullif(trim(request_row.display_name), ''),
    nullif(split_part(current_user_email, '@', 1), ''),
    'Employee'
  );

  insert into public.profiles (id, organization_id, role, display_name, is_active)
  values (current_user_id, target_org.id, 'employee', fallback_name, true)
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      role = 'employee',
      display_name = excluded.display_name,
      is_active = true,
      updated_at = now();

  owner_user_id := coalesce(public.owner_user_id_for_org(target_org.id), admin_profile.id);

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
    terminated_at,
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
    current_user_email,
    'active',
    admin_profile.id,
    false,
    current_date,
    null,
    fallback_name,
    0,
    false,
    null
  )
  on conflict do nothing;

  update public.registration_requests rr
  set consumed_at = now(),
      consumed_by = current_user_id
  where rr.email = request_row.email;

  perform public.sync_profile_membership(current_user_id);

  select p.* into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  perform public.append_audit_log(
    existing_profile.organization_id,
    current_user_id,
    'profile',
    current_user_id,
    'session_registration_completed',
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
  return public.ensure_profile_from_session(null);
end;
$$;

create or replace function public.ensure_profile_from_auth(
  desired_role_input text default null,
  display_name_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ensure_profile_from_session(display_name_input);
end;
$$;

create or replace function public.create_owner_admin_claim(
  target_email_input text,
  target_display_name_input text default 'Татьяна',
  notes_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles;
  normalized_email text := lower(trim(coalesce(target_email_input, '')));
  normalized_display_name text := coalesce(nullif(trim(target_display_name_input), ''), 'Татьяна');
  current_user_email text;
  claim_row public.owner_admin_claims;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = current_user_id
    and p.role = 'admin'
    and p.is_active = true
  for update;

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if normalized_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  select lower(nullif(trim(au.email), ''))
  into current_user_email
  from auth.users au
  where au.id = current_user_id;

  if normalized_email = current_user_email then
    raise exception 'OWNER_ADMIN_CLAIM_TARGET_IS_CURRENT_ADMIN';
  end if;

  if exists (
    select 1
    from public.owner_admin_claims c
    where c.organization_id = current_profile.organization_id
      and c.status = 'pending'
  ) then
    raise exception 'OWNER_ADMIN_CLAIM_ALREADY_PENDING';
  end if;

  insert into public.owner_admin_claims (
    organization_id,
    target_email,
    target_display_name,
    status,
    requested_by_profile_id,
    source_admin_profile_id,
    notes
  )
  values (
    current_profile.organization_id,
    normalized_email,
    normalized_display_name,
    'pending',
    current_profile.id,
    current_profile.id,
    nullif(trim(notes_input), '')
  )
  returning * into claim_row;

  perform public.append_audit_log(
    current_profile.organization_id,
    current_user_id,
    'owner_admin_claim',
    claim_row.id,
    'owner_admin_claim_created',
    null,
    to_jsonb(claim_row)
  );

  return jsonb_build_object(
    'claim_id', claim_row.id,
    'organization_id', claim_row.organization_id,
    'target_email', claim_row.target_email,
    'target_display_name', claim_row.target_display_name,
    'status', claim_row.status
  );
end;
$$;

create or replace function public.cancel_owner_admin_claim(
  claim_id_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles;
  previous_claim public.owner_admin_claims;
  updated_claim public.owner_admin_claims;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = current_user_id
    and p.role = 'admin'
    and p.is_active = true;

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select c.* into previous_claim
  from public.owner_admin_claims c
  where c.id = claim_id_input
    and c.organization_id = current_profile.organization_id
  for update;

  if not found then
    raise exception 'OWNER_ADMIN_CLAIM_NOT_FOUND';
  end if;

  if previous_claim.status <> 'pending' then
    raise exception 'OWNER_ADMIN_CLAIM_NOT_PENDING';
  end if;

  update public.owner_admin_claims
  set status = 'cancelled',
      cancelled_at = now()
  where id = previous_claim.id
  returning * into updated_claim;

  perform public.append_audit_log(
    current_profile.organization_id,
    current_user_id,
    'owner_admin_claim',
    updated_claim.id,
    'owner_admin_claim_cancelled',
    to_jsonb(previous_claim),
    to_jsonb(updated_claim)
  );

  return jsonb_build_object(
    'claim_id', updated_claim.id,
    'status', updated_claim.status
  );
end;
$$;

create or replace function public.claim_owner_admin_from_session()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  current_user_confirmed_at timestamptz;
  metadata_display_name text;
  claim_row public.owner_admin_claims;
  previous_claim public.owner_admin_claims;
  target_org public.organizations;
  source_admin_profile public.profiles;
  target_profile public.profiles;
  owner_employee public.employees;
  previous_owner_employee public.employees;
  normalized_display_name text;
  deactivated_admins jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    lower(nullif(trim(au.email), '')),
    au.email_confirmed_at,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), '')
    )
  into current_user_email, current_user_confirmed_at, metadata_display_name
  from auth.users au
  where au.id = current_user_id;

  if current_user_email is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if current_user_confirmed_at is null then
    raise exception 'EMAIL_NOT_CONFIRMED';
  end if;

  select c.* into claim_row
  from public.owner_admin_claims c
  where lower(c.target_email) = current_user_email
    and c.status = 'pending'
  order by c.requested_at asc
  limit 1
  for update;

  if not found then
    raise exception 'OWNER_ADMIN_CLAIM_NOT_FOUND';
  end if;

  previous_claim := claim_row;

  select o.* into target_org
  from public.organizations o
  where o.id = claim_row.organization_id
  for update;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  select p.* into source_admin_profile
  from public.profiles p
  where p.id = claim_row.source_admin_profile_id
  for update;

  if not found then
    raise exception 'OWNER_ADMIN_SOURCE_NOT_FOUND';
  end if;

  if source_admin_profile.id = current_user_id then
    raise exception 'OWNER_ADMIN_CLAIM_TARGET_IS_CURRENT_ADMIN';
  end if;

  select p.* into target_profile
  from public.profiles p
  where p.id = current_user_id
  for update;

  if found and target_profile.organization_id <> claim_row.organization_id then
    raise exception 'OWNER_ADMIN_CLAIM_PROFILE_ORG_MISMATCH';
  end if;

  select e.* into owner_employee
  from public.employees e
  where e.organization_id = claim_row.organization_id
    and e.is_owner = true
    and e.status <> 'archived'
  order by
    case when e.profile_id = source_admin_profile.id then 0 else 1 end,
    e.created_at asc
  limit 1
  for update;

  if not found then
    raise exception 'OWNER_EMPLOYEE_NOT_FOUND';
  end if;

  previous_owner_employee := owner_employee;

  if exists (
    select 1
    from public.employees e
    where e.organization_id = claim_row.organization_id
      and e.id <> owner_employee.id
      and e.status <> 'archived'
      and (e.profile_id = current_user_id or e.auth_user_id = current_user_id)
  ) then
    raise exception 'OWNER_ADMIN_CLAIM_TARGET_ALREADY_EMPLOYEE';
  end if;

  if exists (
    select 1
    from public.employees e
    where e.organization_id = claim_row.organization_id
      and e.id <> owner_employee.id
      and e.status <> 'archived'
      and lower(coalesce(e.work_email, '')) = current_user_email
  ) then
    raise exception 'OWNER_ADMIN_CLAIM_TARGET_EMAIL_ALREADY_EMPLOYEE';
  end if;

  normalized_display_name := coalesce(
    nullif(trim(claim_row.target_display_name), ''),
    metadata_display_name,
    nullif(split_part(current_user_email, '@', 1), ''),
    'Татьяна'
  );

  with deactivated as (
    update public.profiles p
    set is_active = false,
        updated_at = now()
    where p.organization_id = claim_row.organization_id
      and p.role = 'admin'
      and p.is_active = true
      and p.id <> current_user_id
    returning p.*
  )
  select coalesce(jsonb_agg(to_jsonb(deactivated)), '[]'::jsonb)
  into deactivated_admins
  from deactivated;

  insert into public.profiles (id, organization_id, role, display_name, is_active)
  values (current_user_id, claim_row.organization_id, 'admin', normalized_display_name, true)
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      role = 'admin',
      display_name = excluded.display_name,
      is_active = true,
      updated_at = now();

  update public.organizations
  set created_by = current_user_id,
      updated_at = now()
  where id = claim_row.organization_id;

  update public.employees
  set user_id = current_user_id,
      updated_at = now()
  where organization_id = claim_row.organization_id
    and user_id = source_admin_profile.id;

  update public.shifts
  set user_id = current_user_id,
      updated_at = now()
  where organization_id = claim_row.organization_id
    and user_id = source_admin_profile.id;

  update public.payments
  set user_id = current_user_id,
      updated_at = now()
  where organization_id = claim_row.organization_id
    and user_id = source_admin_profile.id;

  update public.employees
  set user_id = current_user_id,
      profile_id = current_user_id,
      auth_user_id = current_user_id,
      work_email = current_user_email,
      status = 'active',
      archived = false,
      archived_at = null,
      is_owner = true,
      hired_at = coalesce(hired_at, current_date),
      terminated_at = null,
      name = normalized_display_name,
      updated_at = now()
  where id = owner_employee.id
  returning * into owner_employee;

  update public.owner_admin_claims
  set status = 'completed',
      claimed_by_profile_id = current_user_id,
      claimed_by_auth_user_id = current_user_id,
      claimed_at = now()
  where id = claim_row.id
  returning * into claim_row;

  perform public.sync_profile_membership(current_user_id);

  perform public.append_audit_log(
    claim_row.organization_id,
    current_user_id,
    'owner_admin_claim',
    claim_row.id,
    'owner_admin_claim_completed',
    jsonb_build_object(
      'claim', to_jsonb(previous_claim),
      'owner_employee', to_jsonb(previous_owner_employee),
      'deactivated_admins', deactivated_admins
    ),
    jsonb_build_object(
      'claim', to_jsonb(claim_row),
      'owner_employee', to_jsonb(owner_employee),
      'new_admin_profile_id', current_user_id
    )
  );

  return jsonb_build_object(
    'claim_id', claim_row.id,
    'organization_id', claim_row.organization_id,
    'role', 'admin',
    'owner_employee_id', owner_employee.id,
    'deactivated_admins', deactivated_admins
  );
end;
$$;

alter table public.owner_admin_claims enable row level security;

drop policy if exists "owner_admin_claims_select_admin" on public.owner_admin_claims;

create policy "owner_admin_claims_select_admin" on public.owner_admin_claims
for select
using (public.is_admin() and organization_id = public.current_organization_id());

grant execute on function public.ensure_profile_from_session(text) to authenticated;
grant execute on function public.ensure_profile_from_registration() to authenticated;
grant execute on function public.ensure_profile_from_auth(text, text) to authenticated;
grant execute on function public.create_owner_admin_claim(text, text, text) to authenticated;
grant execute on function public.cancel_owner_admin_claim(uuid) to authenticated;
grant execute on function public.claim_owner_admin_from_session() to authenticated;

commit;
