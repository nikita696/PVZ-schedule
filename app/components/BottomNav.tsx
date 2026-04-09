import { CalendarDays, CreditCard, Home, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { cn } from './ui/utils';

const ADMIN_NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Главная', icon: Home },
  { to: '/admin/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/admin/payments', label: 'Выплаты', icon: CreditCard },
];

const EMPLOYEE_NAV_ITEMS = [
  { to: '/employee/dashboard', label: 'Главная', icon: Home },
  { to: '/employee/calendar', label: 'График', icon: CalendarDays },
  { to: '/employee/payments', label: 'Выплаты', icon: CreditCard },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { access } = useApp();

  if (!access) return null;

  const navItems = access.role === 'admin' ? ADMIN_NAV_ITEMS : EMPLOYEE_NAV_ITEMS;

  const handleSignOut = async () => {
    const result = await signOut();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Вы вышли из аккаунта.');
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="sticky bottom-0 z-20 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-1 gap-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                isActive
                  ? 'border-orange-200 bg-orange-50 text-orange-700'
                  : 'border-border bg-white text-muted-foreground hover:bg-stone-50',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-stone-50"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </div>
  );
}
