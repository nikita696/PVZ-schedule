import { Database, Shield, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const FEATURE_CARDS = [
  {
    icon: Database,
    title: 'Нормальная структура данных',
    body: 'Сотрудники, смены и выплаты хранятся в таблицах Supabase, а не в одном app_state JSON.',
  },
  {
    icon: Shield,
    title: 'Защита по ролям',
    body: 'Владелец видит весь ПВЗ, сотрудник видит только свои данные.',
  },
  {
    icon: UserRound,
    title: 'Простой вход',
    body: 'Без лишних шагов: обычная регистрация и вход по email/паролю.',
  },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, status } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [submitting, setSubmitting] = useState<'none' | 'login' | 'owner'>('none');

  const isDisabled = status === 'loading' || status === 'missing-config' || submitting !== 'none';

  const handleLogin = async () => {
    setSubmitting('login');
    const result = await signIn(loginEmail.trim(), loginPassword);
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Вход выполнен.');
    navigate('/', { replace: true });
  };

  const handleOwnerSignup = async () => {
    setSubmitting('owner');
    const result = await signUp(ownerEmail.trim(), ownerPassword);
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Аккаунт владельца создан.');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,white_38%,#f5f5f4)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.95fr]">
        <Card className="justify-between overflow-hidden border-orange-100 bg-white/90 shadow-xl shadow-orange-100/40">
          <CardContent className="flex h-full flex-col gap-8 p-8 sm:p-10">
            <div className="flex flex-col gap-5">
              <div className="w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700">
                PVZ Schedule Pro
              </div>

              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                  Учет смен и выплат для маленького ПВЗ без таблиц в чате и случайных JSON-файлов.
                </h1>
                <p className="max-w-xl text-base leading-7 text-stone-600">
                  Владелец управляет графиком, ставками и подтверждением выплат. Сотрудник видит только свой
                  календарь, расчет и выплаты.
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
          <CardContent className="p-6 sm:p-8">
            <Tabs defaultValue="signin" className="gap-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Вход</TabsTrigger>
                <TabsTrigger value="owner-signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-5">
                <SectionTitle
                  title="Вход в систему"
                  subtitle="Email/пароль для владельца и сотрудника."
                />

                <AuthForm
                  email={loginEmail}
                  password={loginPassword}
                  status={status}
                  disabled={isDisabled}
                  submitting={submitting === 'login'}
                  submitLabel="Войти"
                  onEmailChange={setLoginEmail}
                  onPasswordChange={setLoginPassword}
                  onSubmit={() => void handleLogin()}
                />
              </TabsContent>

              <TabsContent value="owner-signup" className="space-y-5">
                <SectionTitle
                  title="Регистрация владельца"
                  subtitle="Создает рабочее пространство ПВЗ."
                />

                <AuthForm
                  email={ownerEmail}
                  password={ownerPassword}
                  status={status}
                  disabled={isDisabled}
                  submitting={submitting === 'owner'}
                  submitLabel="Создать аккаунт владельца"
                  onEmailChange={setOwnerEmail}
                  onPasswordChange={setOwnerPassword}
                  onSubmit={() => void handleOwnerSignup()}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h2>
      <p className="text-sm leading-6 text-stone-500">{subtitle}</p>
    </div>
  );
}

interface AuthFormProps {
  email: string;
  password: string;
  status: string;
  disabled: boolean;
  submitting: boolean;
  submitLabel: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

function AuthForm({
  email,
  password,
  status,
  disabled,
  submitting,
  submitLabel,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthFormProps) {
  return (
    <div className="space-y-4">
      {status === 'missing-config' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Не настроены переменные Supabase. Добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
        </div>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="auth-email">Email</label>
        <Input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="auth-password">Пароль</label>
        <Input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Минимум 6 символов"
        />
      </div>

      <Button className="w-full bg-orange-600 hover:bg-orange-500" onClick={onSubmit} disabled={disabled}>
        {submitting ? 'Подождите...' : submitLabel}
      </Button>
    </div>
  );
}
