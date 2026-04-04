import { Home, Calendar, Wallet } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            isActive('/')
              ? 'text-orange-600'
              : 'text-neutral-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-xs">Dashboard</span>
        </Link>
        
        <Link
          to="/calendar"
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            isActive('/calendar')
              ? 'text-orange-600'
              : 'text-neutral-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-xs">Calendar</span>
        </Link>
        
        <Link
          to="/payments"
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
            isActive('/payments')
              ? 'text-orange-600'
              : 'text-neutral-500'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-xs">Payments</span>
        </Link>
      </div>
    </nav>
  );
}
