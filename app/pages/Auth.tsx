import { KeyRound, LogIn, Mail, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LanguageToggle } from '../components/LanguageToggle';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

type AuthMode = 'sign-in' | 'sign-up' | 'reset';

const getLandingPath = (role: 'admin' | 'employee') => (
  role === 'admin' ? '/admin/dashboard' : '/employee/dashboard'
);

const MIN_PASSWORD_LENGTH = 6;

export default function AuthPage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { access, error: appError, refreshData } = useApp();
  const {
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    updatePassword,
    claimOwnerAdmin,
    signOut,
    status,
    user,
    recentAccounts,
    isCompletingAuth,
    authError,
    passwordRecovery,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBusy = status === 'loading' || status === 'missing-config' || isCompletingAuth || submitting;
  const currentError = authError ?? (status === 'authenticated' && !access ? appError : null);
  const landingPath = access ? getLandingPath(access.role) : null;

  const heading = passwordRecovery
    ? t('Новый пароль', 'New password')
    : t('Вход по email и паролю', 'Email and password sign-in');

  const statusText = useMemo(() => {
    if (status === 'missing-config') {
      return t(
        'Supabase пока не настроен. Проверь переменные окружения приложения.',
        'Supabase is not configured yet. Check the app environment variables.',
      );
    }

    if (passwordRecovery) {
      return t('Задай новый пароль для текущего аккаунта.', 'Set a new password for the current account.');
    }

    if (status === 'authenticated' && access) {
      return t(
        'Сессия активна, доступ уже определён сервером.',
        'The session is active, and access was resolved on the server.',
      );
    }

    if (status === 'authenticated' && !access) {
      return t(
        'Email вошёл в Auth, но рабочий профиль ещё не привязан.',
        'The email is signed in to Auth, but no workspace profile is linked yet.',
      );
    }

    return t(
      'Администратор и сотрудник входят отдельными email/password аккаунтами.',
      'Admin and employee access use separate email/password accounts.',
    );
  }, [access, passwordRecovery, status, t]);

  const requirePassword = (value: string) => {
    if (value.length < MIN_PASSWORD_LENGTH) {
      return t('Пароль должен быть не короче 6 символов.', 'Password must be at least 6 characters.');
    }

    return null;
  };

  const handlePasswordRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();

    const validationError = requirePassword(newPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(newPassword);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message);
    setNewPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();

    if (mode !== 'reset') {
      const validationError = requirePassword(password);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }

    setSubmitting(true);
    const result = mode === 'sign-in'
      ? await signInWithPassword({ email, password })
      : mode === 'sign-up'
        ? await signUpWithPassword({ email, password, displayName })
        : await sendPasswordReset(email);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message);
    if (mode === 'reset') {
      setPassword('');
    }
  };

  const handleClaimOwnerAdmin = async () => {
    clearAuthError();
    setSubmitting(true);
    const result = await claimOwnerAdmin();
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message);
    await refreshData();
    navigate('/admin/dashboard', { replace: true });
  };

  const handleSignOut = async () => {
    const result = await signOut();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message);
  };

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl content-center gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="space-y-4 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-orange-700">PVZ Schedule</div>
                <CardTitle className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                  {heading}
                </CardTitle>
              </div>
              <LanguageToggle />
            </div>
            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
              {statusText}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0">
            {currentError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {currentError}
              </div>
            ) : null}

            {passwordRecovery ? (
              <form className="space-y-4" onSubmit={(event) => void handlePasswordRecovery(event)}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('Новый пароль', 'New password')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={isBusy}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-500" disabled={isBusy}>
                  <KeyRound className="h-4 w-4" />
                  {submitting ? t('Сохраняю...', 'Saving...') : t('Сохранить пароль', 'Save password')}
                </Button>
              </form>
            ) : null}

            {!passwordRecovery && status === 'authenticated' && access && landingPath ? (
              <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900">
                  {t(
                    `Ты вошёл${user?.email ? ` как ${user.email}` : ''}. Доступ ${access.role === 'admin' ? 'администратора' : 'сотрудника'} активен.`,
                    `You are signed in${user?.email ? ` as ${user.email}` : ''}. ${access.role === 'admin' ? 'Admin' : 'Employee'} access is active.`,
                  )}
                </p>
                <Button onClick={() => navigate(landingPath, { replace: true })} className="w-full bg-emerald-600 hover:bg-emerald-500">
                  <ShieldCheck className="h-4 w-4" />
                  {t('Открыть приложение', 'Open the app')}
                </Button>
              </div>
            ) : null}

            {!passwordRecovery && status === 'authenticated' && !access ? (
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-950">
                  {t(
                    'Если для этого email подготовлена передача владельца, забери права администратора явно. Иначе выйди и войди правильным email сотрудника.',
                    'If an owner transfer is prepared for this email, claim admin access explicitly. Otherwise sign out and use the correct employee email.',
                  )}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => void handleClaimOwnerAdmin()} disabled={isBusy} className="bg-orange-600 hover:bg-orange-500">
                    <ShieldCheck className="h-4 w-4" />
                    {submitting ? t('Проверяю...', 'Checking...') : t('Забрать права администратора', 'Claim admin access')}
                  </Button>
                  <Button variant="outline" onClick={() => void handleSignOut()} disabled={isBusy}>
                    {t('Выйти', 'Sign out')}
                  </Button>
                </div>
              </div>
            ) : null}

            {!passwordRecovery && status !== 'authenticated' ? (
              <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
                <TabsList className="grid w-full grid-cols-3 rounded-md">
                  <TabsTrigger value="sign-in" className="rounded">
                    <LogIn className="h-4 w-4" />
                    {t('Вход', 'Sign in')}
                  </TabsTrigger>
                  <TabsTrigger value="sign-up" className="rounded">
                    <UserRoundPlus className="h-4 w-4" />
                    {t('Регистрация', 'Sign up')}
                  </TabsTrigger>
                  <TabsTrigger value="reset" className="rounded">
                    <Mail className="h-4 w-4" />
                    {t('Сброс', 'Reset')}
                  </TabsTrigger>
                </TabsList>

                <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                  <TabsContent value="sign-in" className="space-y-4">
                    <EmailPasswordFields
                      email={email}
                      password={password}
                      disabled={isBusy}
                      passwordLabel={t('Пароль', 'Password')}
                      onEmailChange={setEmail}
                      onPasswordChange={setPassword}
                    />
                  </TabsContent>

                  <TabsContent value="sign-up" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="display-name">{t('Имя в приложении', 'Display name')}</Label>
                      <Input
                        id="display-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        disabled={isBusy}
                        placeholder={t('Татьяна', 'Tatiana')}
                      />
                    </div>
                    <EmailPasswordFields
                      email={email}
                      password={password}
                      disabled={isBusy}
                      passwordLabel={t('Пароль', 'Password')}
                      onEmailChange={setEmail}
                      onPasswordChange={setPassword}
                    />
                  </TabsContent>

                  <TabsContent value="reset" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={isBusy}
                        required
                      />
                    </div>
                  </TabsContent>

                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-500" disabled={isBusy}>
                    {mode === 'sign-in' ? <LogIn className="h-4 w-4" /> : mode === 'sign-up' ? <UserRoundPlus className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    {submitting || isCompletingAuth
                      ? t('Подожди...', 'One moment...')
                      : mode === 'sign-in'
                        ? t('Войти', 'Sign in')
                        : mode === 'sign-up'
                          ? t('Создать аккаунт', 'Create account')
                          : t('Отправить ссылку', 'Send reset link')}
                  </Button>
                </form>
              </Tabs>
            ) : null}

            {status === 'missing-config' ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t(
                  'Нужны `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` и включённый Email provider в Supabase Auth.',
                  'You need `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the Email provider enabled in Supabase Auth.',
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-base">{t('Недавние входы', 'Recent sign-ins')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {recentAccounts.length > 0 ? recentAccounts.slice(0, 5).map((account) => (
              <div key={account.authUserId} className="rounded-md border border-stone-200 p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 border border-stone-200">
                    {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.displayName} /> : null}
                    <AvatarFallback className="bg-stone-100 text-xs font-semibold text-stone-700">
                      {account.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-stone-900">{account.displayName}</div>
                    <div className="truncate text-xs text-stone-500">{account.email ?? t('Email не найден', 'Email not found')}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-stone-500">
                  {account.lastResolvedRole === 'admin'
                    ? t('Администратор', 'Admin')
                    : account.lastResolvedRole === 'employee'
                      ? t('Сотрудник', 'Employee')
                      : t('Роль не определена', 'Role is not defined')}
                  {' · '}
                  {new Date(account.lastSignedInAt).toLocaleString(locale)}
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-dashed border-stone-300 p-4 text-sm text-stone-500">
                {t('После успешного входа аккаунты появятся здесь.', 'Successful sign-ins will appear here.')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function EmailPasswordFields({
  email,
  password,
  disabled,
  passwordLabel,
  onEmailChange,
  onPasswordChange,
}: {
  email: string;
  password: string;
  disabled: boolean;
  passwordLabel: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="auth-password">{passwordLabel}</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          disabled={disabled}
          required
        />
      </div>
    </>
  );
}
