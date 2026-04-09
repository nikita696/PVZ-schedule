import { Suspense, type ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import { Button } from './components/ui/button';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { lazyWithRetry } from './lib/lazyWithRetry';

const AuthPage = lazyWithRetry(() => import('./pages/Auth'), 'auth-page');
const DashboardPage = lazyWithRetry(() => import('./pages/Dashboard'), 'dashboard-page');
const CalendarPage = lazyWithRetry(() => import('./pages/Calendar'), 'calendar-page');
const PaymentsPage = lazyWithRetry(() => import('./pages/Payments'), 'payments-page');

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="rounded-2xl border bg-white px-6 py-4 text-sm text-muted-foreground shadow-sm">
        Загрузка...
      </div>
    </div>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Неизвестная ошибка.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Обновить страницу</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>На главную</Button>
        </div>
      </div>
    </div>
  );
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{node}</Suspense>;
}

const getRoleLandingPath = (role: 'admin' | 'employee') => (
  role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
);

function AuthOnlyLayout() {
  const { status: authStatus } = useAuth();
  const { status: appStatus, access } = useApp();

  if (authStatus === 'loading' || appStatus === 'loading') {
    return <RouteLoader />;
  }

  if (authStatus === 'authenticated' && access) {
    return <Navigate to={getRoleLandingPath(access.role)} replace />;
  }

  return <Outlet />;
}

function RoleLayout({ role }: { role: 'admin' | 'employee' }) {
  const { status: authStatus } = useAuth();
  const { status: appStatus, access } = useApp();

  if (authStatus === 'loading' || appStatus === 'loading') {
    return <RouteLoader />;
  }

  if (authStatus === 'missing-config') {
    return <Navigate to="/auth/login" replace />;
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" replace />;
  }

  if (!access) {
    return <Navigate to="/auth/login" replace />;
  }

  if (access.role !== role) {
    return <Navigate to={getRoleLandingPath(access.role)} replace />;
  }

  return <Outlet />;
}

function RootRedirect() {
  const { status: authStatus } = useAuth();
  const { status: appStatus, access } = useApp();

  if (authStatus === 'loading' || appStatus === 'loading') {
    return <RouteLoader />;
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" replace />;
  }

  if (!access) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to={getRoleLandingPath(access.role)} replace />;
}

function StubPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">
        Раздел {title} находится в доработке. Бизнес-логика уже разделена по ролям, UI этого экрана доделаем следующим шагом.
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/auth',
    element: <AuthOnlyLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'login', element: withSuspense(<AuthPage />) },
      { path: 'register-admin', element: <Navigate to="/auth/login" replace /> },
      { path: 'activate-employee', element: <Navigate to="/auth/login" replace /> },
      { path: 'reset-password', element: <Navigate to="/auth/login" replace /> },
      { index: true, element: <Navigate to="/auth/login" replace /> },
    ],
  },
  {
    path: '/admin',
    element: <RoleLayout role="admin" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'employees', element: withSuspense(<DashboardPage />) },
      { path: 'calendar', element: withSuspense(<CalendarPage />) },
      { path: 'payments', element: withSuspense(<PaymentsPage />) },
      { path: 'finance', element: <StubPage title="Финансы" /> },
      { path: 'settings', element: <StubPage title="Настройки" /> },
      { path: 'import-export', element: <StubPage title="Импорт / Экспорт" /> },
      { path: 'audit', element: <StubPage title="Аудит" /> },
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
    ],
  },
  {
    path: '/employee',
    element: <RoleLayout role="employee" />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'calendar', element: withSuspense(<CalendarPage />) },
      { path: 'shifts', element: withSuspense(<CalendarPage />) },
      { path: 'payments', element: withSuspense(<PaymentsPage />) },
      { path: 'profile', element: <StubPage title="Мой профиль" /> },
      { index: true, element: <Navigate to="/employee/dashboard" replace /> },
    ],
  },
  {
    path: '/dashboard',
    element: <RootRedirect />,
  },
  {
    path: '/calendar',
    element: <RootRedirect />,
  },
  {
    path: '/payments',
    element: <RootRedirect />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
