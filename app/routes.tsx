import { lazy, Suspense, type ReactNode } from 'react';
import {
  Navigate,
  Outlet,
  createBrowserRouter,
} from 'react-router';
import { useAuth } from './context/AuthContext';

const AuthPage = lazy(() => import('./pages/Auth'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const PaymentsPage = lazy(() => import('./pages/Payments'));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="rounded-2xl border bg-white px-6 py-4 text-sm text-muted-foreground shadow-sm">
        Загрузка...
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
  },
  {
    element: <ProtectedLayout />,
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
