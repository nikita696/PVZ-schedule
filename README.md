# PVZ Schedule

���������� ��� ����� ����, ���������� � ������ ����������� ���.

������ ��� �� localStorage-�������, � ���������� fullstack-���������� �� React + Vite + Supabase:
- ����������� ����� Supabase Auth
- ��������������� ���� ������ `employees / shifts / payments`
- RLS-�������� �� ������ ��
- ������-������ ������� ���������� � ������ � ��������� �������� ����
- ��������� ����������� � ������ ������
- `typecheck`, `lint`, `test`, production build

## �����������

- ���� ����������� � �� ������
- ����� ����������� ��� ������ �������
- ��������� ���� �� ����
- �������� ���������� ����, ��� ��� ���������� ��� �� ������ ������
- ������� ������
- ������:
  - ���������
  - ���������
  - � �������
  - ���������� �������
- ������� � ������ ��������� �����

## ����

- React 18
- Vite
- TypeScript (`strict: true`)
- Supabase Auth + Postgres + RLS
- Tailwind CSS
- Vitest
- ESLint

## �����������

�������� ���� �������:

- `app/domain`
  - ���������� ����
  - ������ ������-������ ������� ���������� � ����������
- `app/data`
  - ����������� ������ � Supabase
- `app/context`
  - auth provider
  - app provider / orchestration layer
- `app/lib`
  - ��������������� �������: backup, date, preferences, result, supabase client
- `app/pages`
  - Dashboard, Calendar, Payments, Auth

## ������� �����

### 1. �������� ������ � Supabase

� Supabase �����:
- ������� ����� project
- �������� Email/Password provider � `Authentication -> Providers`

### 2. ��������� ����� ��

�������� SQL Editor � Supabase � ��������� ����:

- [supabase/schema.sql](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/supabase/schema.sql)

����� �������:
- ������� `employees`, `shifts`, `payments`
- �������
- `updated_at` triggers
- RLS policies, ����� ������ ������������ ����� ������ ���� ������

### 3. ��������� ���������� ���������

�������� `.env.local` ��� ��������� `.env` �� �������:

- [\.env.example](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/.env.example)

�����:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. ��������� ������

```bash
npm install
npm run dev
```

## �������

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

## ������� ��������� �������

��� ��� �������:
- ���������� ���������� � JSON-sync `app_state` �� ������� Supabase
- ��������� ����������� � ���������� ��������
- �������� �������� ������ ������� � ��������� ����
- ������� `strict` TypeScript
- ��������� ������� � ����� �� �������� ������

��� ��� ����� �������:
- ������ �� Vercel � production Supabase project
- e2e-����� ���������������� ���������
- audit/cleanup UI-������������ ��� ���������� bundle size
- code splitting, ������ ��� ������� production bundle ��� ���������

## ��� ������������ ������

������������ ��� ��������� ��� �������������:

> ���������� ���������� ��� ����� ���� � ������ ����������� ���.  
> ���������� �������������, �����������, ���������������� state layer, ������� ���������� � �������������, ������� ������, ����� �����������, �������/������ ������ � backend �� Supabase � ��������������� ������ �� � RLS.

