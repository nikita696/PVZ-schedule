import { createBrowserRouter } from 'react-router';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Payments } from './pages/Payments';
import { BottomNav } from './components/BottomNav';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Layout>
        <Dashboard />
      </Layout>
    ),
  },
  {
    path: '/calendar',
    element: (
      <Layout>
        <Calendar />
      </Layout>
    ),
  },
  {
    path: '/payments',
    element: (
      <Layout>
        <Payments />
      </Layout>
    ),
  },
]);
