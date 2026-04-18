begin;

create or replace function public.update_employee_name_record(
  employee_id_input uuid,
  name_input text
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  employee_row public.employees;
  linked_profile_id uuid;
  normalized_name text := nullif(trim(name_input), '');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into current_profile
  from public.current_profile();

  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  if current_profile.role <> 'admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if normalized_name is null then
    raise exception 'EMPLOYEE_NAME_REQUIRED';
  end if;

  if char_length(normalized_name) > 80 then
    raise exception 'EMPLOYEE_NAME_TOO_LONG';
  end if;

  update public.employees
  set name = normalized_name,
      updated_at = now()
  where id = employee_id_input
    and organization_id = current_profile.organization_id
    and status <> 'archived'
  returning * into employee_row;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  linked_profile_id := coalesce(employee_row.profile_id, employee_row.auth_user_id);

  if linked_profile_id is not null then
    update public.profiles
    set display_name = normalized_name,
        updated_at = now()
    where id = linked_profile_id
      and organization_id = current_profile.organization_id;
  end if;

  return employee_row;
end;
$$;

grant execute on function public.update_employee_name_record(uuid, text) to authenticated;

commit;
