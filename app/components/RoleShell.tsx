import { CalendarDays, CreditCard, Home, LogOut, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { LanguageToggle } from './LanguageToggle';
import { cn } from './ui/utils';

type ShellRole = 'admin' | 'employee';

interface RoleShellProps {
  role: ShellRole;
  children: ReactNode;
}

const ROLE_META: Record<ShellRole, {
  badgeClassName: string;
  headerClassName: string;
}> = {
  admin: {
    badgeClassName: 'border border-orange-200 bg-orange-100 text-orange-700',
    headerClassName: 'bg-[radial-gradient(circle_at_top_left,#fff7ed,white_62%)]',
  },
  employee: {
    badgeClassName: 'border border-sky-200 bg-sky-100 text-sky-700',
    headerClassName: 'bg-[radial-gradient(circle_at_top_left,#eff6ff,white_62%)]',
  },
};

export function RoleShell({ role, children }: RoleShellProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUserSummary, updateCurrentUserName } = useApp();
  const { signOut, switchAccount } = useAuth();
  const [busyAction, setBusyAction] = useState<'logout' | 'switch' | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setNameDraft(currentUserSummary?.displayName ?? '');
  }, [currentUserSummary?.displayName]);

  const links = useMemo(() => (
    role === 'admin'
      ? [
          {
            to: '/admin/dashboard',
            label: t('Сводка', 'Overview'),
            icon: Home,
            title: t('Сотрудники, график и выплаты', 'Team, schedule, and payments'),
            description: t(
              'Здесь собрана управленческая сводка по команде, графику и заявкам на выплаты.',
              'This is the management overview for the team, schedule, and payment requests.',
            ),
            roleBadge: t('Администратор', 'Admin'),
            sectionBadge: t('Управляющий кабинет', 'Management workspace'),
          },
          {
            to: '/admin/employees',
            label: t('Сотрудники', 'Employees'),
            icon: UsersRound,
            title: t('Сотрудники', 'Employees'),
            description: t(
              'Здесь ты добавляешь сотрудников, меняешь ставки, отправляешь людей в архив и выгружаешь расчётные листы.',
              'Add employees, edit rates, archive people, and export payslips here.',
            ),
            roleBadge: t('Администратор', 'Admin'),
            sectionBadge: t('Управляющий кабинет', 'Management workspace'),
          },
          {
            to: '/admin/calendar',
            label: t('Календарь', 'Calendar'),
            icon: CalendarDays,
            title: t('Календарь', 'Calendar'),
            description: t(
              'Здесь ты собираешь и утверждаешь общий график смен по ПВЗ.',
              'Build and approve the shared pickup-point shift schedule here.',
            ),
            roleBadge: t('Администратор', 'Admin'),
            sectionBadge: t('Управляющий кабинет', 'Management workspace'),
          },
          {
            to: '/admin/payments',
            label: t('Выплаты', 'Payments'),
            icon: CreditCard,
            title: t('Выплаты', 'Payments'),
            description: t(
              'Здесь ты смотришь заявки сотрудников и подтверждаешь или отклоняешь выплаты.',
              'Review employee requests and approve or reject payments here.',
            ),
            roleBadge: t('Администратор', 'Admin'),
            sectionBadge: t('Управляющий кабинет', 'Management workspace'),
          },
        ]
      : [
          {
            to: '/employee/dashboard',
            label: t('Сводка', 'Overview'),
            icon: Home,
            title: t('Мой график, выплаты и расчёт', 'My schedule, payments, and summary'),
            description: t(
              'Здесь собрана твоя личная сводка: заработок, выплаты и быстрый доступ к расчётному листу.',
              'Your personal summary lives here: earnings, payments, and quick access to the payslip.',
            ),
            roleBadge: t('Сотрудник', 'Employee'),
            sectionBadge: t('Личный кабинет сотрудника', 'Employee workspace'),
          },
          {
            to: '/employee/calendar',
            label: t('Мой график', 'My schedule'),
            icon: CalendarDays,
            title: t('Мой график', 'My schedule'),
            description: t(
              'Здесь ты смотришь общий календарь и свои смены по месяцам.',
              'View the shared calendar and your shifts by month here.',
            ),
            roleBadge: t('Сотрудник', 'Employee'),
            sectionBadge: t('Личный кабинет сотрудника', 'Employee workspace'),
          },
          {
            to: '/employee/payments',
            label: t('Мои выплаты', 'My payments'),
            icon: CreditCard,
            title: t('Мои выплаты', 'My payments'),
            description: t(
              'Здесь собраны только твои выплаты и их текущие статусы.',
              'Only your payments and their current statuses are shown here.',
            ),
            roleBadge: t('Сотрудник', 'Employee'),
            sectionBadge: t('Личный кабинет сотрудника', 'Employee workspace'),
          },
        ]
  ), [role, t]);

  const shellMeta = ROLE_META[role];

  const routeLabel = useMemo(() => {
    const matchedLink = links.find((link) => location.pathname.startsWith(link.to));
    return matchedLink?.label ?? matchedLink?.roleBadge ?? t('Пользователь', 'User');
  }, [links, location.pathname, t]);

  const pageMeta = useMemo(() => {
    const matchedLink = links.find((link) => location.pathname.startsWith(link.to));
    return matchedLink ?? null;
  }, [links, location.pathname]);

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

    toast.success(result.message ?? t('Открываю Яндекс ID с выбором аккаунта...', 'Opening Yandex ID account chooser...'));
  };

  const handleSaveName = async () => {
    setSavingName(true);
    const result = await updateCurrentUserName(nameDraft);
    setSavingName(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? t('Имя обновлено.', 'Display name updated.'));
  };

  const isNameDirty = nameDraft.trim() !== (currentUserSummary?.displayName ?? '').trim();

  return (
    <>
      <header className={cn(
        'sticky top-0 z-30 border-b border-stone-200 backdrop-blur',
        shellMeta.headerClassName,
      )}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Avatar className="size-12 border border-stone-200">
                {currentUserSummary?.avatarUrl ? (
                  <AvatarImage src={currentUserSummary.avatarUrl} alt={currentUserSummary.displayName} />
                ) : null}
                <AvatarFallback className="bg-stone-100 text-sm font-semibold text-stone-700">
                  {currentUserSummary?.initials ?? 'PV'}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', shellMeta.badgeClassName)}>
                    {pageMeta?.roleBadge ?? t('Пользователь', 'User')}
                  </span>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {routeLabel}
                  </span>
                </div>

                <div>
                  <div className="text-base font-semibold text-stone-900">
                    {currentUserSummary?.displayName ?? t('Пользователь', 'User')}
                  </div>
                  <div className="text-sm text-stone-500">
                    {currentUserSummary?.email ?? t('Email не найден', 'Email not found')}
                  </div>
                </div>

                {pageMeta ? (
                  <div className="space-y-1">
                    <div className="text-xl font-semibold text-stone-900">
                      {pageMeta.title}
                    </div>
                    <p className="text-sm text-stone-600">{pageMeta.description}</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="text-xs font-medium text-stone-500 sm:min-w-[190px]">
                    {t('Как тебя показывать в системе', 'How to show your name in the app')}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      placeholder={t('Твоё имя в кабинете', 'Your display name')}
                      className="h-9 w-full sm:w-64"
                    />
                    <Button
                      onClick={() => void handleSaveName()}
                      disabled={savingName || !nameDraft.trim() || !isNameDirty}
                      className="h-9"
                    >
                      {savingName ? t('Сохраняю...', 'Saving...') : t('Сохранить имя', 'Save name')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <LanguageToggle compact />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleSwitchAccount()}
                  disabled={busyAction !== null || savingName}
                >
                  <RefreshCw className="h-4 w-4" />
                  {busyAction === 'switch' ? t('Переключаю...', 'Switching...') : t('Сменить аккаунт', 'Switch account')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  disabled={busyAction !== null || savingName}
                >
                  <LogOut className="h-4 w-4" />
                  {busyAction === 'logout' ? t('Выхожу...', 'Signing out...') : t('Выйти', 'Sign out')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {pageMeta?.sectionBadge ?? t('Рабочая область', 'Workspace')}
            </div>
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
