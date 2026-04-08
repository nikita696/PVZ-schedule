import { Suspense, type ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import { Button } from './components/ui/button';
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

function ProtectedLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <RouteLoader />;
  }

  if (status === 'missing-config') {
    return <Navigate to="/auth" replace />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}

function AuthOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <RouteLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return withSuspense(<AuthPage />);
}

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthOnlyRoute />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: withSuspense(<DashboardPage />),
      },
      {
        path: '/calendar',
        element: withSuspense(<CalendarPage />),
      },
      {
        path: '/payments',
        element: withSuspense(<PaymentsPage />),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
