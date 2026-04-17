import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
