import { CalendarDays, CreditCard, Home, LogOut, RefreshCw, Settings, UsersRound } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { LanguageToggle } from './LanguageToggle';

type ShellRole = 'admin' | 'employee';

interface RoleShellProps {
  role: ShellRole;
  children: ReactNode;
}

const ROLE_META: Record<ShellRole, {
  badgeClassName: string;
}> = {
  admin: {
    badgeClassName: 'border border-orange-200 bg-orange-100 text-orange-700',
  },
  employee: {
    badgeClassName: 'border border-sky-200 bg-sky-100 text-sky-700',
  },
};

export function RoleShell({ role, children }: RoleShellProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUserSummary } = useApp();
  const { signOut, switchAccount } = useAuth();
  const [busyAction, setBusyAction] = useState<'logout' | 'switch' | null>(null);

  const links = useMemo(() => (
    role === 'admin'
      ? [
          {
            to: '/admin/dashboard',
            label: t('Сводка', 'Overview'),
            icon: Home,
            title: t('Сводка', 'Overview'),
            roleBadge: t('Администратор', 'Admin'),
          },
          {
            to: '/admin/employees',
            label: t('Сотрудники', 'Employees'),
            icon: UsersRound,
            title: t('Сотрудники', 'Employees'),
            roleBadge: t('Администратор', 'Admin'),
          },
          {
            to: '/admin/calendar',
            label: t('Календарь', 'Calendar'),
            icon: CalendarDays,
            title: t('Календарь', 'Calendar'),
            roleBadge: t('Администратор', 'Admin'),
          },
          {
            to: '/admin/payments',
            label: t('Выплаты', 'Payments'),
            icon: CreditCard,
            title: t('Выплаты', 'Payments'),
            roleBadge: t('Администратор', 'Admin'),
          },
          {
            to: '/admin/settings',
            label: t('Настройки', 'Settings'),
            icon: Settings,
            title: t('Настройки', 'Settings'),
            roleBadge: t('Администратор', 'Admin'),
          },
        ]
      : [
          {
            to: '/employee/dashboard',
            label: t('Сводка', 'Overview'),
            icon: Home,
            title: t('Сводка', 'Overview'),
            roleBadge: t('Сотрудник', 'Employee'),
          },
          {
            to: '/employee/calendar',
            label: t('Мой график', 'My schedule'),
            icon: CalendarDays,
            title: t('Мой график', 'My schedule'),
            roleBadge: t('Сотрудник', 'Employee'),
          },
          {
            to: '/employee/payments',
            label: t('Мои выплаты', 'My payments'),
            icon: CreditCard,
            title: t('Мои выплаты', 'My payments'),
            roleBadge: t('Сотрудник', 'Employee'),
          },
        ]
  ), [role, t]);

  const shellMeta = ROLE_META[role];
  const normalizedPathname = useMemo(() => (
    location.pathname.startsWith('/employee/shifts')
      ? location.pathname.replace('/employee/shifts', '/employee/calendar')
      : location.pathname
  ), [location.pathname]);
  const isCalendarWorkspace = /^\/(admin|employee)\/calendar(\/classic)?$/.test(normalizedPathname);

  const pageMeta = useMemo(() => {
    const matchedLink = links.find((link) => normalizedPathname.startsWith(link.to));
    return matchedLink ?? null;
  }, [links, normalizedPathname]);

  const handleSignOut = async () => {
    setBusyAction('logout');
    const result = await signOut();
    setBusyAction(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? t('Ты вышел из аккаунта.', 'You have signed out.'));
    navigate('/auth/login', { replace: true });
  };

  const handleSwitchAccount = async () => {
    setBusyAction('switch');
    const result = await switchAccount();
    setBusyAction(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? t('Открыл вход для другого аккаунта.', 'Ready to sign in with another account.'));
    navigate('/auth/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div
          className={cn(
            'mx-auto flex flex-col gap-3 py-3',
            isCalendarWorkspace ? 'max-w-[1500px] px-3 sm:px-4' : 'max-w-7xl px-4 sm:px-6',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-10 border border-stone-200">
                {currentUserSummary?.avatarUrl ? (
                  <AvatarImage src={currentUserSummary.avatarUrl} alt={currentUserSummary.displayName} />
                ) : null}
                <AvatarFallback className="bg-stone-100 text-xs font-semibold text-stone-700">
                  {currentUserSummary?.initials ?? 'PV'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', shellMeta.badgeClassName)}>
                    {pageMeta?.roleBadge ?? t('Пользователь', 'User')}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-stone-900">
                  {currentUserSummary?.displayName ?? t('Пользователь', 'User')}
                </div>
                <div className="truncate text-xs text-stone-500">
                  {currentUserSummary?.email ?? t('Email не найден', 'Email not found')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LanguageToggle compact />
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void handleSwitchAccount()}
                disabled={busyAction !== null}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {busyAction === 'switch' ? t('Переключаю...', 'Switching...') : t('Сменить аккаунт', 'Switch account')}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void handleSignOut()}
                disabled={busyAction !== null}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {busyAction === 'logout' ? t('Выхожу...', 'Signing out...') : t('Выйти', 'Sign out')}
                </span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                  isActive
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
