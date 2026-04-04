# PVZ-schedule (Figma version)

Проект на React + Vite для учета смен и выплат сотрудников ПВЗ.

## Запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Хранение данных

По умолчанию данные сохраняются в `localStorage` и не теряются при перезагрузке страницы.

Дополнительно можно подключить Supabase (рекомендуется для синхронизации между устройствами):

1. Создайте таблицу `app_state`:

```sql
create table if not exists app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);
```

2. Добавьте переменные окружения в Vercel/локально:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Если переменные не заданы, приложение продолжит работать только через `localStorage`.


## Stage 2: схема БД (Supabase)

В репозитории добавлен файл `supabase/schema.sql` с нормализованными таблицами:
- `employees`
- `shifts`
- `payments`
- `app_state` (для обратной совместимости)

Переменные окружения можно взять из `.env.example`.
