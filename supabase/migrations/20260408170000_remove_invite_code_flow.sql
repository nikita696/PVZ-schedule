alter table public.employees
  drop column if exists invite_code;

drop index if exists public.employees_invite_code_uidx;

drop function if exists public.claim_employee_invite(text);
drop function if exists public.regenerate_employee_invite(uuid);
drop function if exists public.generate_invite_code();
