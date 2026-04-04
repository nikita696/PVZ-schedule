-- Stage 2 schema for normalized data storage in Supabase.
-- This schema is optional for now; app currently uses `app_state` JSON sync.

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  daily_rate integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('working', 'day-off', 'sick', 'no-show', 'none')),
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  amount integer not null check (amount >= 0),
  payment_date date not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);
