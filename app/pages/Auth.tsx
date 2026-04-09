import { ArrowRightLeft, Database, LogIn, LogOut, Plus, Shield, Trash2, UserCircle2, UserRoundPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const FEATURE_CARDS = [
  {
    icon: Database,
    title: 'История хранится в базе',
    body: 'Смены, ставки и выплаты живут в Supabase и не завязаны на одном браузере.',
  },
  {
    icon: Shield,
    title: 'Один администратор',
    body: 'Система не даст создать второго активного администратора и сохранит права владельца.',
  },
  {
    icon: UserRoundPlus,
    title: 'Переключение аккаунтов',
    body: 'Повторно авторизовываться не нужно: знакомые аккаунты можно открывать прямо с экрана входа.',
  },
] as const;

const getLandingPath = (role: 'admin' | 'employee') => (
  role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
);

const getRoleLabel = (role: 'admin' | 'employee' | null) => {
  if (role === 'admin') return 'Администратор';
  if (role === 'employee') return 'Сотрудник';
  return 'Без роли';
};

const getInitials = (value: string) => {
  const chunks = value.trim().split(/\s+/).filter(Boolean);
  if (chunks.length === 0) return '•';
  return chunks.slice(0, 2).map((item) => item[0]?.toUpperCase() ?? '').join('') || '•';
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { access, status: appStatus, error: appError } = useApp();
  const {
    startYandexAuth,
    switchRememberedAccount,
    forgetRememberedAccount,
    signOut,
    signOutAll,
    rememberedAccounts,
    status,
    user,
    isCompletingOAuth,
    oauthError,
    clearOAuthError,
  } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [submitting, setSubmitting] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [signOutMode, setSignOutMode] = useState<'current' | 'all' | null>(null);

  const currentUserId = user?.id ?? null;
  const isBusy = status === 'loading' || status === 'missing-config' || isCompletingOAuth || submitting || !!switchingAccountId || signOutMode !== null;
  const currentError = oauthError ?? (status === 'authenticated' && !access ? appError : null);
  const landingPath = access ? getLandingPath(access.role) : null;

  const hintText = useMemo(() => {
    if (status === 'missing-config') {
      return 'Supabase пока не настроен. Проверь переменные окружения приложения.';
    }

    if (status === 'authenticated' && access) {
      return 'Аккаунт уже готов. Можно открыть кабинет или быстро переключиться на другой сохранённый аккаунт.';
    }

    if (rememberedAccounts.length > 0) {
      return 'Ниже есть сохранённые аккаунты. Их можно открыть сразу, без повторной авторизации через провайдера.';
    }

    return 'Используй тот же Яндекс-аккаунт, к которому привязан твой рабочий email. Для нового аккаунта выбери роль ниже и войди один раз.';
  }, [access, rememberedAccounts.length, status]);

  const handleYandexAuth = async () => {
    setSubmitting(true);
    clearOAuthError();

    const result = await startYandexAuth({
      displayName: displayName.trim(),
      role,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Открываю вход через Яндекс ID...');
  };

  const handleSwitchRememberedAccount = async (accountId: string, accountRole: 'admin' | 'employee' | null) => {
    setSwitchingAccountId(accountId);
    clearOAuthError();

    const result = await switchRememberedAccount(accountId);

    setSwitchingAccountId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Аккаунт переключён.');

    const nextRole = result.data.role ?? accountRole;
    if (nextRole) {
      navigate(getLandingPath(nextRole), { replace: true });
    }
  };

  const handleForgetRememberedAccount = (accountId: string, label: string) => {
    forgetRememberedAccount(accountId);
    toast.success(`Аккаунт ${label} удалён из локального списка.`);
  };

  const handleSignOutCurrent = async () => {
    setSignOutMode('current');
    const result = await signOut();
    setSignOutMode(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Текущий аккаунт закрыт.');
  };

  const handleSignOutAll = async () => {
    setSignOutMode('all');
    const result = await signOutAll();
    setSignOutMode(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Все аккаунты очищены.');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,white_38%,#f5f5f4)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.95fr]">
        <Card className="justify-between overflow-hidden border-orange-100 bg-white/90 shadow-xl shadow-orange-100/40">
          <CardContent className="flex h-full flex-col gap-8 p-8 sm:p-10">
            <div className="flex flex-col gap-5">
              <div className="w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                PVZ Schedule
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                  Вход и регистрация через Яндекс ID
                </h1>
                <p className="max-w-xl text-base leading-7 text-stone-600">
                  Здесь можно как первый раз войти через Яндекс, так и быстро открыть уже знакомый аккаунт — почти как в сервисах Google или Яндекса, только без лишней бюрократии.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {FEATURE_CARDS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                  <Icon className="h-5 w-5 text-orange-600" />
                  <h2 className="mt-4 text-lg font-semibold text-stone-900">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white/95 shadow-xl shadow-stone-200/40">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-xs leading-5 text-stone-600">
              {hintText}
            </div>

            {currentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {currentError}
              </div>
            ) : null}

            {status === 'authenticated' && access && landingPath ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900">
                  Ты уже вошёл{user?.email ? ` как ${user.email}` : ''}. Доступ {access.role === 'admin' ? 'администратора' : 'сотрудника'} активен.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate(landingPath, { replace: true })} className="bg-emerald-600 hover:bg-emerald-500">
                    Открыть приложение
                  </Button>
                  <Button variant="outline" onClick={() => void handleSignOutCurrent()} disabled={signOutMode !== null}>
                    <LogOut className="h-4 w-4" />
                    {signOutMode === 'current' ? 'Выход...' : 'Выйти из текущего'}
                  </Button>
                </div>
              </div>
            ) : null}

            {rememberedAccounts.length > 0 ? (
              <section className="space-y-4">
                <SectionTitle
                  title="Сохранённые аккаунты"
                  subtitle="Можно открыть уже знакомый аккаунт без повторной авторизации через провайдера."
                />

                <div className="grid gap-3">
                  {rememberedAccounts.map((account) => {
                    const isCurrent = currentUserId === account.userId && status === 'authenticated';

                    return (
                      <div key={account.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          {account.avatarUrl ? (
                            <img
                              src={account.avatarUrl}
                              alt={account.displayName}
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700">
                              {getInitials(account.displayName || account.email)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-stone-900">
                                {account.displayName || account.email}
                              </div>
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                                {getRoleLabel(account.role)}
                              </span>
                              {isCurrent ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                  Текущий
                                </span>
                              ) : null}
                            </div>
                            <div className="truncate text-xs text-stone-500">{account.email}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isCurrent && landingPath ? (
                            <Button variant="outline" onClick={() => navigate(landingPath, { replace: true })}>
                              <UserCircle2 className="h-4 w-4" />
                              Открыть
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => void handleSwitchRememberedAccount(account.id, account.role)}
                              disabled={isBusy}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              {switchingAccountId === account.id ? 'Переключаю...' : 'Войти'}
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => handleForgetRememberedAccount(account.id, account.displayName || account.email)}
                            disabled={isBusy}
                          >
                            <Trash2 className="h-4 w-4" />
                            Забыть
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void handleSignOutAll()} disabled={signOutMode !== null}>
                    <Trash2 className="h-4 w-4" />
                    {signOutMode === 'all' ? 'Очищаю...' : 'Забыть все аккаунты'}
                  </Button>
                </div>
              </section>
            ) : null}

            {status === 'authenticated' && !access ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {isCompletingOAuth || appStatus === 'loading'
                  ? 'Завершаю вход и привязываю профиль...'
                  : 'Сессия есть, но профиль пока не собран. Нажми кнопку входа ещё раз с правильной ролью или дождись завершения привязки.'}
              </div>
            ) : null}

            <section className="space-y-4">
              <SectionTitle
                title={rememberedAccounts.length > 0 ? 'Добавить ещё аккаунт' : 'Продолжить через Яндекс'}
                subtitle={rememberedAccounts.length > 0
                  ? 'Новый аккаунт тоже попадёт в локальный список и потом будет открываться в один тап.'
                  : 'Для нового пользователя роль выбирается перед входом. Для уже зарегистрированного роль и имя ниже можно не менять.'}
              />

              <Field label="Как тебя показывать в системе (необязательно)">
                <Input
                  aria-label="Имя в системе"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Например, Ник"
                  disabled={isBusy}
                />
              </Field>

              <div className="space-y-3">
                <Label>Роль при первом входе</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value === 'admin' ? 'admin' : 'employee')}
                  className="grid gap-3"
                  disabled={isBusy}
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300">
                    <RadioGroupItem value="employee" id="role-employee" className="mt-1" />
                    <div className="space-y-1">
                      <div className="font-medium text-stone-900">Сотрудник</div>
                      <p className="text-sm leading-6 text-stone-600">
                        Видит общий график, управляет только своими пожеланиями и своими выплатами.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300">
                    <RadioGroupItem value="admin" id="role-admin" className="mt-1" />
                    <div className="space-y-1">
                      <div className="font-medium text-stone-900">Администратор</div>
                      <p className="text-sm leading-6 text-stone-600">
                        Полный доступ к сотрудникам, графику и выплатам. Активный администратор в системе может быть только один.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <Button
                className="w-full bg-orange-600 hover:bg-orange-500"
                onClick={() => void handleYandexAuth()}
                disabled={isBusy}
              >
                {rememberedAccounts.length > 0 ? <Plus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {submitting ? 'Перенаправляю...' : rememberedAccounts.length > 0 ? 'Добавить аккаунт через Яндекс ID' : 'Войти через Яндекс ID'}
              </Button>
            </section>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              Если сотрудник уже создан администратором, входи через тот же Яндекс-аккаунт, где указан этот email.
              Система сама привяжет профиль к сотруднику и запомнит его для следующего входа.
            </div>

            {status === 'missing-config' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Нужны `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` и настройка провайдера `custom:yandex` в Supabase Auth.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
      <p className="text-sm leading-6 text-stone-500">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
