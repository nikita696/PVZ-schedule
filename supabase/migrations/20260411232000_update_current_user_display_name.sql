begin;

create or replace function public.update_current_user_display_name(display_name_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := nullif(trim(display_name_input), '');
  profile_row public.profiles;
  employee_row public.employees;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if normalized_name is null then
    raise exception 'DISPLAY_NAME_REQUIRED';
  end if;

  if char_length(normalized_name) > 80 then
    raise exception 'DISPLAY_NAME_TOO_LONG';
  end if;

  perform public.sync_profile_membership(current_user_id);

  update public.profiles
  set display_name = normalized_name,
      updated_at = now()
  where id = current_user_id
  returning * into profile_row;

  if not found then
    raise exception 'PROFILE_REQUIRED';
  end if;

  update public.employees
  set name = normalized_name,
      updated_at = now()
  where organization_id = profile_row.organization_id
    and status <> 'archived'
    and (
      profile_id = current_user_id
      or auth_user_id = current_user_id
    )
  returning * into employee_row;

  return jsonb_build_object(
    'display_name', profile_row.display_name,
    'employee', to_jsonb(employee_row)
  );
end;
$$;

grant execute on function public.update_current_user_display_name(text) to authenticated;

commit;
