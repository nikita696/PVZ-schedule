# PVZ Schedule

Приложение для учета смен, начислений и выплат сотрудников ПВЗ.

Теперь это не localStorage-игрушка, а нормальное fullstack-приложение на React + Vite + Supabase:
- авторизация через Supabase Auth
- нормализованная база данных `employees / shifts / payments`
- RLS-политики на уровне БД
- бизнес-логика расчета начислений и долгов в отдельном доменном слое
- резервное копирование и импорт данных
- `typecheck`, `lint`, `test`, production build

## Возможности

- учет сотрудников и их ставок
- архив сотрудников без потери истории
- календарь смен по дням
- контроль проблемных дней, где нет сотрудника или их больше одного
- история выплат
- расчет:
  - начислено
  - выплачено
  - к выплате
  - помесячный остаток
- экспорт и импорт резервной копии

## Стек

- React 18
- Vite
- TypeScript (`strict: true`)
- Supabase Auth + Postgres + RLS
- Tailwind CSS
- Vitest
- ESLint

## Архитектура

Основные слои проекта:

- `app/domain`
  - предметные типы
  - чистая бизнес-логика расчета начислений и статистики
- `app/data`
  - репозиторий работы с Supabase
- `app/context`
  - auth provider
  - app provider / orchestration layer
- `app/lib`
  - вспомогательные утилиты: backup, date, preferences, result, supabase client
- `app/pages`
  - Dashboard, Calendar, Payments, Auth

## Быстрый старт

### 1. Создайте проект в Supabase

В Supabase нужно:
- создать новый project
- включить Email/Password provider в `Authentication -> Providers`

### 2. Примените схему БД

Откройте SQL Editor в Supabase и выполните файл:

- [supabase/schema.sql](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/supabase/schema.sql)

Схема создаст:
- таблицы `employees`, `shifts`, `payments`
- индексы
- `updated_at` triggers
- RLS policies, чтобы каждый пользователь видел только свои данные

### 3. Настройте переменные окружения

Создайте `.env.local` или заполните `.env` по образцу:

- [\.env.example](/C:/Users/user/Documents/New%20project/PVZ-schedule-main/.env.example)

Нужны:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 4. Запустите проект

```bash
npm install
npm run dev
```

## Скрипты

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
- приложение переведено с JSON-sync `app_state` на таблицы Supabase
- добавлена авторизация и защищенные маршруты
- вынесена доменная логика расчета в отдельный слой
- включен `strict` TypeScript
- добавлены линтинг и тесты на доменную логику

Что еще можно усилить:
- деплой на Vercel с production Supabase project
- e2e-тесты пользовательских сценариев
- audit/cleanup UI-зависимостей для уменьшения bundle size
- code splitting, потому что текущий production bundle еще крупноват

## Как рассказывать проект

Формулировка для портфолио или собеседования:

> Разработал приложение для учета смен и выплат сотрудников ПВЗ.  
> Реализовал маршрутизацию, авторизацию, централизованный state layer, расчеты начислений и задолженности, историю выплат, архив сотрудников, экспорт/импорт данных и backend на Supabase с нормализованной схемой БД и RLS.
