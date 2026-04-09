import { Database, MailCheck, Shield, UserRoundPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';

const FEATURE_CARDS = [
  {
    icon: Database,
    title: 'Единая база',
    body: 'Данные сотрудников, смен и выплат хранятся в Supabase и синхронизируются между ролями.',
  },
  {
    icon: Shield,
    title: 'Один администратор',
    body: 'Первый зарегистрированный администратор получает права управления. Второй админ не создаётся.',
  },
  {
    icon: UserRoundPlus,
    title: 'Регистрация по email',
    body: 'Пользователь получает ссылку на почту, подтверждает вход и автоматически попадает в базу.',
  },
];

const isValidEmail = (value: string) => value.trim().length > 3 && value.includes('@');

export default function AuthPage() {
  const navigate = useNavigate();
  const { requestLoginLink, registerByEmail, status } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerAsAdmin, setRegisterAsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState<'none' | 'login' | 'register'>('none');

  const isBaseDisabled = status === 'loading' || status === 'missing-config' || submitting !== 'none';
  const canSubmitLogin = !isBaseDisabled && isValidEmail(loginEmail);
  const canSubmitRegistration = !isBaseDisabled && isValidEmail(registerEmail);

  const hintText = useMemo(() => (
    status === 'missing-config'
      ? 'Не настроены переменные Supabase. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.'
      : 'Вход и регистрация выполняются по одноразовой ссылке из письма.'
  ), [status]);

  const handleRequestLoginLink = async () => {
    if (!isValidEmail(loginEmail)) {
      toast.error('Введи корректный email.');
      return;
    }

    setSubmitting('login');
    const result = await requestLoginLink(loginEmail.trim());
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Ссылка для входа отправлена.');
  };

  const handleRegister = async () => {
    if (!isValidEmail(registerEmail)) {
      toast.error('Введи корректный email для регистрации.');
      return;
    }

    setSubmitting('register');
    const result = await registerByEmail({
      email: registerEmail.trim(),
      displayName: registerDisplayName.trim(),
      isAdmin: registerAsAdmin,
    });
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Регистрация начата. Проверь почту.');
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
                  Регистрация и вход по ссылке из email.
                </h1>
                <p className="max-w-xl text-base leading-7 text-stone-600">
                  На этой странице можно зарегистрировать нового пользователя как сотрудника или первого
                  администратора. После отправки формы письмо со ссылкой приходит на указанный email.
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
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
              {hintText}
            </div>

            {status === 'authenticated' ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900">
                  Ты уже авторизован. Можно перейти в рабочий кабинет.
                </p>
                <Button onClick={() => navigate('/', { replace: true })} className="w-full bg-emerald-600 hover:bg-emerald-500">
                  Перейти в кабинет
                </Button>
              </div>
            ) : null}

            <section className="space-y-4">
              <SectionTitle
                title="Регистрация нового пользователя"
                subtitle="Выбери роль, укажи email и получи ссылку подтверждения."
              />

              <Field label="Email">
                <Input
                  type="email"
                  aria-label="Email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isBaseDisabled}
                />
              </Field>

              <Field label="Имя (опционально)">
                <Input
                  aria-label="Имя (опционально)"
                  value={registerDisplayName}
                  onChange={(event) => setRegisterDisplayName(event.target.value)}
                  placeholder="Как тебя отображать в системе"
                  disabled={isBaseDisabled}
                />
              </Field>

              <label className="flex items-center gap-3 rounded-xl border p-3">
                <Checkbox
                  checked={registerAsAdmin}
                  onCheckedChange={(checked) => setRegisterAsAdmin(checked === true)}
                  disabled={isBaseDisabled}
                />
                <div className="text-sm">
                  <div className="font-medium text-stone-900">Зарегистрировать как администратора</div>
                  <div className="text-stone-600">Только один пользователь в системе может иметь роль администратора.</div>
                </div>
              </label>

              <Button
                className="w-full bg-orange-600 hover:bg-orange-500"
                onClick={() => void handleRegister()}
                disabled={!canSubmitRegistration}
              >
                {submitting === 'register' ? 'Отправляем ссылку...' : 'Зарегистрироваться по email'}
              </Button>
            </section>

            <section className="space-y-4 border-t pt-6">
              <SectionTitle
                title="Уже зарегистрирован?"
                subtitle="Отправь ссылку для входа на свою почту."
              />

              <Field label="Email для входа">
                <Input
                  type="email"
                  aria-label="Email для входа"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={isBaseDisabled}
                />
              </Field>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleRequestLoginLink()}
                disabled={!canSubmitLogin}
              >
                <MailCheck className="h-4 w-4" />
                {submitting === 'login' ? 'Отправляем...' : 'Получить ссылку для входа'}
              </Button>
            </section>

            {status === 'missing-config' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Supabase не настроен. Добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
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
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
