import { Database, LogIn, Shield, UserRoundPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { LanguageToggle } from '../components/LanguageToggle';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const getLandingPath = (role: 'admin' | 'employee') => (
  role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
);

export default function AuthPage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { access, status: appStatus, error: appError } = useApp();
  const {
    startYandexAuth,
    status,
    user,
    recentAccounts,
    isCompletingOAuth,
    oauthError,
    clearOAuthError,
  } = useAuth();

  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [submitting, setSubmitting] = useState(false);

  const featureCards = useMemo(() => [
    {
      icon: Database,
      title: t('Сервер помнит роли', 'Server remembers roles'),
      body: t(
        'Права и привязка к профилю хранятся в базе, а не только в памяти браузера.',
        'Permissions and profile links are stored on the server, not only in browser memory.',
      ),
    },
    {
      icon: Shield,
      title: t('Один активный админ', 'One active admin'),
      body: t(
        'Система не даст создать второго активного администратора и не перепутает роли.',
        'The system blocks a second active admin and keeps roles from getting mixed up.',
      ),
    },
    {
      icon: UserRoundPlus,
      title: t('Гибкий вход через Яндекс', 'Flexible Yandex sign-in'),
      body: t(
        'Обычная кнопка входит в текущий аккаунт, а отдельная кнопка принудительно открывает выбор другого аккаунта.',
        'The main button signs into the current account, while the second one forces account selection.',
      ),
    },
  ], [t]);

  const isBusy = status === 'loading' || status === 'missing-config' || isCompletingOAuth || submitting;
  const currentError = oauthError ?? (status === 'authenticated' && !access ? appError : null);
  const landingPath = access ? getLandingPath(access.role) : null;

  const hintText = useMemo(() => {
    if (status === 'missing-config') {
      return t(
        'Supabase пока не настроен. Проверь переменные окружения приложения.',
        'Supabase is not configured yet. Check the app environment variables.',
      );
    }

    if (status === 'authenticated' && access) {
      return t(
        'Сессия уже активна. Можно сразу открыть нужный кабинет.',
        'A session is already active. You can open the correct workspace right away.',
      );
    }

    if (status === 'authenticated' && !access) {
      return t(
        'Ты уже прошёл OAuth, но профиль ещё не собран. Если это новый пользователь, повтори вход с выбранной ролью.',
        'OAuth is complete, but the profile is not linked yet. If this is a new user, sign in again with the selected role.',
      );
    }

    return t(
      'Вход не запускается сам по себе: Яндекс откроется только после клика по кнопке ниже. Если нужно выбрать другой аккаунт, используй отдельную кнопку.',
      'Sign-in does not start automatically: Yandex opens only after you click a button below. If you need another account, use the separate chooser button.',
    );
  }, [access, status, t]);

  const handleYandexAuth = async (forceAccountSelection = false) => {
    setSubmitting(true);
    clearOAuthError();

    const result = await startYandexAuth(
      {
        role,
      },
      {
        forceAccountSelection,
      },
    );

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.message ?? (
        forceAccountSelection
          ? t('Открываю Яндекс ID с выбором аккаунта...', 'Opening Yandex ID account chooser...')
          : t('Открываю вход через Яндекс ID...', 'Opening Yandex ID sign-in...')
      ),
    );
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,white_38%,#f5f5f4)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.95fr]">
        <Card className="justify-between overflow-hidden border-orange-100 bg-white/90 shadow-xl shadow-orange-100/40">
          <CardContent className="flex h-full flex-col gap-8 p-8 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-5">
                <div className="w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                  PVZ Schedule
                </div>

                <div className="max-w-2xl space-y-4">
                  <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                    {t('Вход и регистрация через Яндекс ID', 'Sign in and register with Yandex ID')}
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-stone-600">
                    {t(
                      'Мы усилили авторизацию: вход запускается вручную, роли берутся с сервера, а внутри приложения теперь видно, кто именно вошёл и с какими правами.',
                      'We tightened authentication: sign-in starts manually, roles come from the server, and the app clearly shows who is logged in and with what permissions.',
                    )}
                  </p>
                </div>
              </div>

              <LanguageToggle />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                  <Icon className="h-5 w-5 text-orange-600" />
                  <h2 className="mt-4 text-lg font-semibold text-stone-900">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
                </div>
              ))}
            </div>

            {recentAccounts.length > 0 ? (
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">{t('Недавние входы', 'Recent sign-ins')}</h2>
                  <p className="text-sm text-stone-500">
                    {t(
                      'Это только память приложения для удобства. Права всё равно проверяются по серверному профилю.',
                      'This is only local app memory for convenience. Permissions are still validated against the server profile.',
                    )}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {recentAccounts.slice(0, 4).map((account) => (
                    <div key={account.authUserId} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-stone-200">
                          {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.displayName} /> : null}
                          <AvatarFallback className="bg-stone-100 text-sm font-semibold text-stone-700">
                            {account.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <div className="truncate font-medium text-stone-900">{account.displayName}</div>
                          <div className="truncate text-sm text-stone-500">{account.email ?? t('Email не найден', 'Email not found')}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-stone-100 px-3 py-1 font-medium text-stone-700">
                          {account.lastResolvedRole === 'admin'
                            ? t('Администратор', 'Admin')
                            : account.lastResolvedRole === 'employee'
                              ? t('Сотрудник', 'Employee')
                              : t('Роль не определена', 'Role is not defined')}
                        </span>
                        <span className="text-stone-500">
                          {t('Последний вход:', 'Last sign-in:')} {new Date(account.lastSignedInAt).toLocaleString(locale)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
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
                  {t(
                    `Ты уже вошёл${user?.email ? ` как ${user.email}` : ''}. Доступ ${access.role === 'admin' ? 'администратора' : 'сотрудника'} активен.`,
                    `You are already signed in${user?.email ? ` as ${user.email}` : ''}. ${access.role === 'admin' ? 'Admin' : 'Employee'} access is active.`,
                  )}
                </p>
                <Button onClick={() => navigate(landingPath, { replace: true })} className="w-full bg-emerald-600 hover:bg-emerald-500">
                  {t('Открыть приложение', 'Open the app')}
                </Button>
              </div>
            ) : null}

            {status === 'authenticated' && !access ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {isCompletingOAuth || appStatus === 'loading'
                  ? t('Завершаю вход и собираю профиль...', 'Finishing sign-in and linking the profile...')
                  : t(
                      'OAuth-сессия уже есть, но роль пока не подтянулась. Если это новый пользователь, запусти вход ещё раз с нужной ролью.',
                      'The OAuth session already exists, but the role is not resolved yet. If this is a new user, start sign-in again with the required role.',
                    )}
              </div>
            ) : null}

            <section className="space-y-4">
              <SectionTitle
                title={t('Продолжить через Яндекс', 'Continue with Yandex')}
                subtitle={t(
                  'Для первого входа выбери роль ниже. Имя теперь задаётся уже внутри личного кабинета.',
                  'For the first sign-in, choose a role below. The display name is now set inside the workspace.',
                )}
              />

              <div className="space-y-3">
                <Label>{t('Роль при первом входе', 'Role on first sign-in')}</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value === 'admin' ? 'admin' : 'employee')}
                  className="grid gap-3"
                  disabled={isBusy}
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300">
                    <RadioGroupItem value="employee" id="role-employee" className="mt-1" />
                    <div className="space-y-1">
                      <div className="font-medium text-stone-900">{t('Сотрудник', 'Employee')}</div>
                      <p className="text-sm leading-6 text-stone-600">
                        {t(
                          'Видит общий график, меняет только свои пожелания и работает со своими выплатами.',
                          'Sees the shared schedule, edits only personal requests, and works only with personal payments.',
                        )}
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-orange-300">
                    <RadioGroupItem value="admin" id="role-admin" className="mt-1" />
                    <div className="space-y-1">
                      <div className="font-medium text-stone-900">{t('Администратор', 'Admin')}</div>
                      <p className="text-sm leading-6 text-stone-600">
                        {t(
                          'Полный доступ к сотрудникам, графику и выплатам. Активный администратор в системе может быть только один.',
                          'Full access to employees, schedule, and payments. Only one active admin can exist in the system.',
                        )}
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="grid gap-3">
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-500"
                  onClick={() => void handleYandexAuth(false)}
                  disabled={isBusy}
                >
                  <LogIn className="h-4 w-4" />
                  {submitting ? t('Перенаправляю...', 'Redirecting...') : t('Войти через Яндекс ID', 'Sign in with Yandex ID')}
                </Button>

                <Button
                  variant="outline"
                  className="w-full border-stone-300 text-stone-900 hover:bg-stone-50"
                  onClick={() => void handleYandexAuth(true)}
                  disabled={isBusy}
                >
                  <UserRoundPlus className="h-4 w-4" />
                  {submitting ? t('Перенаправляю...', 'Redirecting...') : t('Войти другим Яндекс-аккаунтом', 'Use a different Yandex account')}
                </Button>
              </div>
            </section>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              {t(
                'Если сотрудник уже создан администратором, входи через тот же Яндекс-аккаунт, где указан этот email. Если нужно переключиться на другой аккаунт на этом же устройстве, используй кнопку ниже для принудительного выбора.',
                'If an employee was already created by the admin, sign in with the Yandex account that uses the same email. If you need another account on this device, use the separate chooser button.',
              )}
            </div>

            {status === 'missing-config' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {t(
                  'Нужны `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` и настройка провайдера `custom:yandex` в Supabase Auth.',
                  'You need `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and a configured `custom:yandex` provider in Supabase Auth.',
                )}
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
