import { Shield, Database, CalendarDays } from 'lucide-react';
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
    title: 'Нормальная модель данных',
    body: 'Сотрудники, смены и выплаты хранятся в таблицах Supabase, а не в одном app_state blob.',
  },
  {
    icon: Shield,
    title: 'Защищенный доступ',
    body: 'Каждый пользователь видит только свои данные благодаря Supabase Auth и RLS-политикам.',
  },
  {
    icon: CalendarDays,
    title: 'Рабочий процесс ПВЗ',
    body: 'Смены, выплаты и баланс месяца собраны в одном месте под реальные задачи пункта выдачи.',
  },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (mode: 'signin' | 'signup') => {
    setSubmitting(true);
    const result = mode === 'signin'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? (mode === 'signin' ? 'Вход выполнен.' : 'Аккаунт создан.'));
    if (mode === 'signin') {
      navigate('/', { replace: true });
    }
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
                  Ведите смены и выплаты без таблиц в чате, блокнотов и случайных JSON-файлов.
                </h1>
                <p className="max-w-xl text-base leading-7 text-stone-600">
                  Приложение переведено на нормальную базу данных, авторизацию и понятный учет.
                  Войдите, чтобы управлять сотрудниками, сменами и выплатами в одном рабочем окне.
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
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
                    С возвращением
                  </h2>
                  <p className="text-sm leading-6 text-stone-500">
                    Введите email и пароль, чтобы открыть рабочее пространство.
                  </p>
                </div>

                <AuthForm
                  email={email}
                  password={password}
                  status={status}
                  submitting={submitting}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={() => void handleSubmit('signin')}
                  submitLabel="Войти"
                />
              </TabsContent>

              <TabsContent value="signup" className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
                    Создать аккаунт
                  </h2>
                  <p className="text-sm leading-6 text-stone-500">
                    Создайте защищенное рабочее пространство ПВЗ на базе Supabase.
                  </p>
                </div>

                <AuthForm
                  email={email}
                  password={password}
                  status={status}
                  submitting={submitting}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={() => void handleSubmit('signup')}
                  submitLabel="Создать аккаунт"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

interface AuthFormProps {
  email: string;
  password: string;
  status: string;
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
  submitting,
  submitLabel,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthFormProps) {
  const disabled = submitting || status === 'loading' || status === 'missing-config';

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
          placeholder="name@example.com"
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
