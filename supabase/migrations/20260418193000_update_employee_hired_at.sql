create or replace function public.update_employee_hired_at_record(
  employee_id_input uuid,
  hired_at_input date
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

  if hired_at_input is null then
    raise exception 'INVALID_EMPLOYMENT_DATE';
  end if;

  select e.* into previous_row
  from public.employees e
  where e.id = employee_id_input
    and e.organization_id = profile_row.organization_id
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if previous_row.terminated_at is not null and hired_at_input > previous_row.terminated_at then
    raise exception 'INVALID_EMPLOYMENT_DATE';
  end if;

  if exists (
    select 1
    from public.shifts s
    where s.organization_id = profile_row.organization_id
      and s.employee_id = employee_id_input
      and s.work_date < hired_at_input
  ) then
    raise exception 'EMPLOYEE_HAS_SHIFTS_BEFORE_HIRE_DATE';
  end if;

  update public.employees
  set hired_at = hired_at_input,
      updated_at = now()
  where id = previous_row.id
  returning * into updated_row;

  perform public.append_audit_log(
    profile_row.organization_id,
    auth.uid(),
    'employee',
    updated_row.id,
    'employee_hired_at_updated',
    to_jsonb(previous_row),
    to_jsonb(updated_row)
  );

  return updated_row;
end;
$$;

grant execute on function public.update_employee_hired_at_record(uuid, date) to authenticated;
