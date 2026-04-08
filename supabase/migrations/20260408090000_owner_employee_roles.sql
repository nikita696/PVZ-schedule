create extension if not exists pgcrypto;

alter table public.employees
  add column if not exists auth_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists invite_code text null,
  add column if not exists is_owner boolean not null default false,
  add column if not exists hired_at date null,
  add column if not exists archived_at timestamptz null;

alter table public.payments
  add column if not exists status text not null default 'confirmed',
  add column if not exists created_by_auth_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists confirmed_by_auth_user_id uuid null references auth.users(id) on delete set null;

update public.payments
set status = 'confirmed'
where status is null;

alter table public.shifts
  drop constraint if exists shifts_status_check;

update public.shifts
set status = case
  when status = 'working' and work_date < current_date then 'worked'
  when status = 'working' then 'planned-work'
  when status = 'day-off' then 'day-off'
  when status = 'sick' then 'sick'
  when status = 'no-show' then 'no-show'
  when status = 'planned-work' then 'planned-work'
  when status = 'worked' then 'worked'
  when status = 'vacation' then 'vacation'
  else 'day-off'
end;

alter table public.shifts
  add constraint shifts_status_check
  check (status in ('planned-work', 'worked', 'day-off', 'vacation', 'sick', 'no-show'));

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('entered', 'confirmed'));

create index if not exists employees_auth_user_id_idx on public.employees (auth_user_id);
create unique index if not exists employees_auth_user_id_uidx on public.employees (auth_user_id) where auth_user_id is not null;
create unique index if not exists employees_invite_code_uidx on public.employees (invite_code) where invite_code is not null;
create index if not exists payments_status_idx on public.payments (status);

alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.payments enable row level security;

drop policy if exists "employees_select_own" on public.employees;
drop policy if exists "employees_insert_own" on public.employees;
drop policy if exists "employees_update_own" on public.employees;
drop policy if exists "employees_delete_own" on public.employees;
drop policy if exists "employees_select_owner_or_self" on public.employees;
drop policy if exists "employees_insert_owner" on public.employees;
drop policy if exists "employees_update_owner" on public.employees;
drop policy if exists "employees_delete_owner" on public.employees;

create policy "employees_select_owner_or_self" on public.employees
for select
using (auth.uid() = user_id or auth.uid() = auth_user_id);

create policy "employees_insert_owner" on public.employees
for insert
with check (auth.uid() = user_id);

create policy "employees_update_owner" on public.employees
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "employees_delete_owner" on public.employees
for delete
using (auth.uid() = user_id);

drop policy if exists "shifts_select_own" on public.shifts;
drop policy if exists "shifts_insert_own" on public.shifts;
drop policy if exists "shifts_update_own" on public.shifts;
drop policy if exists "shifts_delete_own" on public.shifts;
drop policy if exists "shifts_select_owner_or_employee" on public.shifts;
drop policy if exists "shifts_insert_owner" on public.shifts;
drop policy if exists "shifts_update_owner" on public.shifts;
drop policy if exists "shifts_delete_owner" on public.shifts;

create policy "shifts_select_owner_or_employee" on public.shifts
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.employees employees_view
    where employees_view.id = shifts.employee_id
      and employees_view.auth_user_id = auth.uid()
  )
);

create policy "shifts_insert_owner" on public.shifts
for insert
with check (auth.uid() = user_id);

create policy "shifts_update_owner" on public.shifts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "shifts_delete_owner" on public.shifts
for delete
using (auth.uid() = user_id);

drop policy if exists "payments_select_own" on public.payments;
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_update_own" on public.payments;
drop policy if exists "payments_delete_own" on public.payments;
drop policy if exists "payments_select_owner_or_employee" on public.payments;
drop policy if exists "payments_insert_owner_or_employee" on public.payments;
drop policy if exists "payments_update_owner_or_employee" on public.payments;
drop policy if exists "payments_delete_owner_or_employee" on public.payments;

create policy "payments_select_owner_or_employee" on public.payments
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.employees employees_view
    where employees_view.id = payments.employee_id
      and employees_view.auth_user_id = auth.uid()
  )
);

create policy "payments_insert_owner_or_employee" on public.payments
for insert
with check (
  auth.uid() = user_id
  or (
    status = 'entered'
    and confirmed_by_auth_user_id is null
    and created_by_auth_user_id = auth.uid()
    and exists (
      select 1
      from public.employees employees_view
      where employees_view.id = payments.employee_id
        and employees_view.auth_user_id = auth.uid()
        and employees_view.user_id = payments.user_id
    )
  )
);

create policy "payments_update_owner_or_employee" on public.payments
for update
using (
  auth.uid() = user_id
  or (
    status = 'entered'
    and created_by_auth_user_id = auth.uid()
    and exists (
      select 1
      from public.employees employees_view
      where employees_view.id = payments.employee_id
        and employees_view.auth_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  or (
    status = 'entered'
    and confirmed_by_auth_user_id is null
    and created_by_auth_user_id = auth.uid()
    and exists (
      select 1
      from public.employees employees_view
      where employees_view.id = payments.employee_id
        and employees_view.auth_user_id = auth.uid()
        and employees_view.user_id = payments.user_id
    )
  )
);

create policy "payments_delete_owner_or_employee" on public.payments
for delete
using (
  auth.uid() = user_id
  or (
    status = 'entered'
    and created_by_auth_user_id = auth.uid()
    and exists (
      select 1
      from public.employees employees_view
      where employees_view.id = payments.employee_id
        and employees_view.auth_user_id = auth.uid()
    )
  )
);

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  generated_code text;
begin
  loop
    generated_code := upper(substr(md5(random()::text || clock_timestamp()::text || coalesce(auth.uid()::text, '')), 1, 8));
    exit when not exists (
      select 1
      from public.employees
      where invite_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.claim_employee_invite(invite_code_input text)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  target_employee public.employees%rowtype;
  normalized_code text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  normalized_code := upper(trim(coalesce(invite_code_input, '')));
  if normalized_code = '' then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.employees existing_employee
    where existing_employee.auth_user_id = auth.uid()
  ) then
    raise exception 'ACCOUNT_ALREADY_LINKED';
  end if;

  select *
  into target_employee
  from public.employees
  where invite_code = normalized_code
    and archived = false
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if target_employee.auth_user_id is not null then
    raise exception 'INVITE_ALREADY_USED';
  end if;

  update public.employees
  set auth_user_id = auth.uid(),
      invite_code = null,
      updated_at = now()
  where id = target_employee.id
  returning * into target_employee;

  return target_employee;
end;
$$;

create or replace function public.regenerate_employee_invite(employee_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_employee public.employees%rowtype;
  next_code text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into target_employee
  from public.employees
  where id = employee_id_input
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if target_employee.user_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  if target_employee.archived then
    raise exception 'EMPLOYEE_ARCHIVED';
  end if;

  if target_employee.auth_user_id is not null then
    raise exception 'EMPLOYEE_ALREADY_LINKED';
  end if;

  next_code := public.generate_invite_code();

  update public.employees
  set invite_code = next_code,
      updated_at = now()
  where id = target_employee.id;

  return next_code;
end;
$$;

grant execute on function public.claim_employee_invite(text) to authenticated;
grant execute on function public.regenerate_employee_invite(uuid) to authenticated;
