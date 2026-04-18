# PVZ Schedule

Приложение для учёта смен, сотрудников и выплат сотрудников ПВЗ.

Проект вырос из localStorage-решения в полноценное fullstack-приложение на React + Vite + Supabase:
- авторизация через Supabase Auth
- нормализованная база данных `employees / shifts / payments`
- RLS-политики на уровне БД
- CRUD-логика поверх доменных сущностей и операций предметной области
- резервное копирование и импорт данных
- `typecheck`, `lint`, `test`, production build

## Возможности

- учёт сотрудников и их статусов
- гибкое планирование и управление сменами
- выплаты раз в день
- сохранение истории смен, даже если сотрудник уже не в активном составе
- быстрые фильтры
- статусы:
  - работает
  - выходной
  - в отпуске
  - больничный лист
- календарь и сводка по выбранному периоду

## Стек

- React 18
- Vite
- TypeScript (`strict: true`)
- Supabase Auth + Postgres + RLS
- Tailwind CSS
- Vitest
- ESLint

## Архитектура

Проект разбит на несколько слоёв:

- `app/domain`
  - доменные типы
  - чистая бизнес-логика поверх сущностей и операций
- `app/data`
  - интеграция данных с Supabase
- `app/context`
  - auth provider
  - app provider / orchestration layer
- `app/lib`
  - вспомогательные модули: backup, date, preferences, result, supabase client
- `app/pages`
  - Dashboard, Calendar, Payments, Auth

## Быстрый старт

### 1. Создать проект в Supabase

В Supabase нужно:
- создать новый project
- включить Email/Password provider в `Authentication -> Providers`

### 2. Накатить схему БД

Открой SQL Editor в Supabase и выполни файл:

- [supabase/schema.sql](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/supabase/schema.sql)

Файл создаёт:
- таблицы `employees`, `shifts`, `payments`
- индексы
- `updated_at` triggers
- RLS policies, чтобы каждый аутентифицированный пользователь видел только свои данные

### 3. Настроить переменные окружения

Создай `.env.local` или скопируй `.env` из шаблона:

- [\.env.example](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/.env.example)

Нужно:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. Запустить проект

```bash
npm install
npm run dev
```

## Команды

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

## Текущее состояние проекта

Что уже сделано:
- реализована синхронизация с JSON-sync `app_state` на стороне Supabase
- настроена авторизация и восстановление сессии
- вынесена бизнес-логика календаря и расчётов смен
- включён `strict` TypeScript
- покрыты тестами ядро и часть UI-критичных сценариев

Что ещё можно сделать:
- выкатить на Vercel с production Supabase project
- e2e-тесты пользовательских сценариев
- audit/cleanup UI-компонентов для уменьшения bundle size
- code splitting, если понадобится production bundle для оптимизации

## Что проверяет проект

Приложение уже подходит для использования:

> Приложение заточено под малый ПВЗ и простую операционную среду.  
> Поддерживает сотрудников, расписание, централизованный state layer, учёт начислений и выплат, резервные копии, импорт состояния, переход/миграцию данных в backend на Supabase и изоляцию данных на БД через RLS.
