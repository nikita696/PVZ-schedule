import { Database, KeyRound, Shield, UserRoundPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

type AuthTab = 'login' | 'register-admin' | 'activate-employee';

const TAB_TO_PATH: Record<AuthTab, string> = {
  login: '/auth/login',
  'register-admin': '/auth/register-admin',
  'activate-employee': '/auth/activate-employee',
};

const FEATURE_CARDS = [
  {
    icon: Database,
    title: 'Нормальная модель данных',
    body: 'Организации, профили, сотрудники, смены и выплаты живут в таблицах Supabase, а не в одном JSON.',
  },
  {
    icon: Shield,
    title: 'Разделение ролей',
    body: 'Администратор управляет ПВЗ, сотрудник работает только со своими сменами и выплатами.',
  },
  {
    icon: UserRoundPlus,
    title: 'Активация по email',
    body: 'Сотрудник активирует аккаунт по рабочему email, который заранее добавил администратор.',
  },
];

const isValidAuthInput = (email: string, password: string) => (
  email.trim().length > 0 && password.trim().length >= 6
);

const getTabByPath = (path: string): AuthTab => {
  if (path.endsWith('/register-admin')) return 'register-admin';
  if (path.endsWith('/activate-employee')) return 'activate-employee';
  return 'login';
};

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, registerAdmin, activateEmployee, status } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [submitting, setSubmitting] = useState<'none' | 'login' | 'admin' | 'employee'>('none');

  const currentTab = getTabByPath(location.pathname);
  const isBaseDisabled = status === 'loading' || status === 'missing-config' || submitting !== 'none';

  const canSubmitLogin = !isBaseDisabled && isValidAuthInput(loginEmail, loginPassword);
  const canSubmitAdmin = !isBaseDisabled
    && isValidAuthInput(adminEmail, adminPassword)
    && organizationName.trim().length > 0;
  const canSubmitEmployee = !isBaseDisabled && isValidAuthInput(employeeEmail, employeePassword);

  const hintText = useMemo(() => (
    status === 'missing-config'
      ? 'Не настроены переменные Supabase. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.'
      : 'Пароль должен быть не короче 6 символов.'
  ), [status]);

  const handleLogin = async () => {
    if (!isValidAuthInput(loginEmail, loginPassword)) {
      toast.error('Введите email и пароль не короче 6 символов.');
      return;
    }

    setSubmitting('login');
    const result = await signIn(loginEmail.trim(), loginPassword.trim());
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Вход выполнен.');
    navigate('/', { replace: true });
  };

  const handleRegisterAdmin = async () => {
    if (!isValidAuthInput(adminEmail, adminPassword)) {
      toast.error('Введите email и пароль не короче 6 символов.');
      return;
    }

    if (!organizationName.trim()) {
      toast.error('Введите название ПВЗ.');
      return;
    }

    setSubmitting('admin');
    const result = await registerAdmin({
      email: adminEmail.trim(),
      password: adminPassword.trim(),
      organizationName: organizationName.trim(),
      displayName: displayName.trim(),
    });
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Кабинет администратора создан.');
    if (status === 'authenticated') {
      navigate('/', { replace: true });
    }
  };

  const handleActivateEmployee = async () => {
    if (!isValidAuthInput(employeeEmail, employeePassword)) {
      toast.error('Введите email и пароль не короче 6 символов.');
      return;
    }

    setSubmitting('employee');
    const result = await activateEmployee(employeeEmail.trim(), employeePassword.trim());
    setSubmitting('none');

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Аккаунт сотрудника активирован.');
    navigate('/', { replace: true });
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
                  Учет смен и выплат для ПВЗ с нормальной ролью администратора и кабинетом сотрудника.
                </h1>
                <p className="max-w-xl text-base leading-7 text-stone-600">
                  Администратор управляет сотрудниками, графиком и выплатами. Сотрудник видит общий график и редактирует только свои данные.
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
            <Tabs
              value={currentTab}
              onValueChange={(value) => navigate(TAB_TO_PATH[value as AuthTab])}
              className="gap-6"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register-admin">Админ</TabsTrigger>
                <TabsTrigger value="activate-employee">Сотрудник</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-5">
                <SectionTitle
                  title="Вход в систему"
                  subtitle="Для администратора и сотрудника с уже активированным аккаунтом."
                />

                <AuthForm
                  hintText={hintText}
                  status={status}
                  canSubmit={canSubmitLogin}
                  submitting={submitting === 'login'}
                  submitLabel="Войти"
                  onSubmit={() => void handleLogin()}
                >
                  <Field label="Email">
                    <Input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Field label="Пароль">
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Минимум 6 символов"
                    />
                  </Field>
                </AuthForm>
              </TabsContent>

              <TabsContent value="register-admin" className="space-y-5">
                <SectionTitle
                  title="Регистрация администратора"
                  subtitle="Создает организацию и кабинет администратора."
                />

                <AuthForm
                  hintText={hintText}
                  status={status}
                  canSubmit={canSubmitAdmin}
                  submitting={submitting === 'admin'}
                  submitLabel="Создать кабинет администратора"
                  onSubmit={() => void handleRegisterAdmin()}
                >
                  <Field label="Название ПВЗ">
                    <Input
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Например: ПВЗ на Ленина"
                    />
                  </Field>
                  <Field label="Имя администратора (опционально)">
                    <Input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Ник"
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(event) => setAdminEmail(event.target.value)}
                      placeholder="admin@example.com"
                    />
                  </Field>
                  <Field label="Пароль">
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      placeholder="Минимум 6 символов"
                    />
                  </Field>
                </AuthForm>
              </TabsContent>

              <TabsContent value="activate-employee" className="space-y-5">
                <SectionTitle
                  title="Активация сотрудника"
                  subtitle="Введи рабочий email, который заранее добавил администратор."
                />

                <AuthForm
                  hintText={hintText}
                  status={status}
                  canSubmit={canSubmitEmployee}
                  submitting={submitting === 'employee'}
                  submitLabel="Активировать аккаунт"
                  onSubmit={() => void handleActivateEmployee()}
                >
                  <Field label="Рабочий email">
                    <Input
                      type="email"
                      value={employeeEmail}
                      onChange={(event) => setEmployeeEmail(event.target.value)}
                      placeholder="employee@example.com"
                    />
                  </Field>
                  <Field label="Пароль">
                    <Input
                      type="password"
                      value={employeePassword}
                      onChange={(event) => setEmployeePassword(event.target.value)}
                      placeholder="Минимум 6 символов"
                    />
                  </Field>
                </AuthForm>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

interface AuthFormProps {
  hintText: string;
  status: string;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  children: ReactNode;
}

function AuthForm({
  hintText,
  status,
  canSubmit,
  submitting,
  submitLabel,
  onSubmit,
  children,
}: AuthFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
        {hintText}
      </div>

      {status === 'missing-config' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Не настроены переменные Supabase. Добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
        </div>
      ) : null}

      {children}

      <Button className="w-full bg-orange-600 hover:bg-orange-500" onClick={onSubmit} disabled={!canSubmit}>
        {submitting ? (
          <>
            <KeyRound className="h-4 w-4 animate-pulse" />
            Подождите...
          </>
        ) : submitLabel}
      </Button>
    </div>
  );
}
