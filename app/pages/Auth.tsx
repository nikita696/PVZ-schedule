import { Database, LogIn, Shield, UserRoundPlus } from 'lucide-react';
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
    title: 'Вход через Яндекс ID',
    body: 'Без magic link и почтовой возни: входишь через Яндекс, а роль подтягивается автоматически.',
  },
] as const;

const getLandingPath = (role: 'admin' | 'employee') => (
  role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
);

export default function AuthPage() {
  const navigate = useNavigate();
  const { access, status: appStatus, error: appError } = useApp();
  const {
    startYandexAuth,
    status,
    user,
    isCompletingOAuth,
    oauthError,
    clearOAuthError,
  } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = status === 'loading' || status === 'missing-config' || isCompletingOAuth || submitting;
  const currentError = oauthError ?? (status === 'authenticated' && !access ? appError : null);
  const landingPath = access ? getLandingPath(access.role) : null;

  const hintText = useMemo(() => {
    if (status === 'missing-config') {
      return 'Supabase пока не настроен. Проверь переменные окружения приложения.';
    }

    if (status === 'authenticated' && access) {
      return 'Аккаунт уже готов. Можно сразу открыть приложение.';
    }

    return 'Используй тот же Яндекс-аккаунт, к которому привязан твой рабочий email. Если ты уже был зарегистрирован, роль восстановится сама.';
  }, [access, status]);

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
                  Мы убрали нестабильный вход по письмам. Теперь новый пользователь выбирает роль,
                  заходит через Яндекс, а система сама создаёт или восстанавливает профиль по email.
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
                <Button onClick={() => navigate(landingPath, { replace: true })} className="w-full bg-emerald-600 hover:bg-emerald-500">
                  Открыть приложение
                </Button>
              </div>
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
                title="Продолжить через Яндекс"
                subtitle="Для нового пользователя роль выбирается перед входом. Для уже зарегистрированного роль и имя ниже можно не менять."
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
                <LogIn className="h-4 w-4" />
                {submitting ? 'Перенаправляю...' : 'Войти через Яндекс ID'}
              </Button>
            </section>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
              Если сотрудник уже создан администратором, входи через тот же Яндекс-аккаунт, где указан этот email.
              Система сама привяжет профиль к сотруднику.
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
