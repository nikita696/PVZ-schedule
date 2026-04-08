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

