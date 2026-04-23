import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { RecentAccount, SessionIdentity, UserRole } from '../domain/types';
import { claimOwnerAdminFromSessionRemote } from '../data/appRepository';
import { buildSessionIdentity, mergeRecentAccounts } from '../lib/sessionIdentity';
import { pickCurrentLanguage } from '../lib/i18n';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';
import { useLanguage } from './LanguageContext';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';

interface PasswordAuthInput {
  email: string;
  password: string;
}

interface SignUpInput extends PasswordAuthInput {
  displayName?: string;
}

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  sessionIdentity: SessionIdentity | null;
  recentAccounts: RecentAccount[];
  isCompletingAuth: boolean;
  authError: string | null;
  passwordRecovery: boolean;
  signInWithPassword: (input: PasswordAuthInput) => Promise<ActionResult<void>>;
  signUpWithPassword: (input: SignUpInput) => Promise<ActionResult<void>>;
  sendPasswordReset: (email: string) => Promise<ActionResult<void>>;
  updatePassword: (password: string) => Promise<ActionResult<void>>;
  claimOwnerAdmin: () => Promise<ActionResult<void>>;
  rememberResolvedIdentity: (input: { role: UserRole; isOwner?: boolean }) => void;
  clearAuthError: () => void;
  signOut: () => Promise<ActionResult<void>>;
  switchAccount: () => Promise<ActionResult<void>>;
}

interface ResolvedIdentityState {
  role: UserRole;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_APP_URL = 'https://pvz-schedule.vercel.app';
const RECENT_ACCOUNTS_STORAGE_KEY = 'pvz-schedule.recent-accounts';

const getAppUrl = (): string => {
  if (typeof window === 'undefined') {
    const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();
    if (configuredAppUrl) {
      return configuredAppUrl.replace(/\/+$/, '');
    }

    return DEFAULT_APP_URL;
  }

  return window.location.origin.replace(/\/+$/, '');
};

const ensureSupabaseClient = (): ActionResult<NonNullable<typeof supabase>> => {
  if (!supabase) {
    return errorResult(pickCurrentLanguage('Supabase не настроен. Проверь переменные окружения.', 'Supabase is not configured. Check the environment variables.'));
  }

  return okResult(supabase);
};

const readRecentAccounts = (): RecentAccount[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(RECENT_ACCOUNTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const account = item as Partial<RecentAccount>;
        if (typeof account.authUserId !== 'string' || !account.authUserId.trim()) {
          return null;
        }

        return {
          authUserId: account.authUserId,
          providerSubject: typeof account.providerSubject === 'string' ? account.providerSubject : null,
          email: typeof account.email === 'string' ? account.email : null,
          displayName: typeof account.displayName === 'string' && account.displayName.trim()
            ? account.displayName
            : pickCurrentLanguage('Пользователь', 'User'),
          avatarUrl: typeof account.avatarUrl === 'string' ? account.avatarUrl : null,
          lastResolvedRole: account.lastResolvedRole === 'admin' || account.lastResolvedRole === 'employee'
            ? account.lastResolvedRole
            : null,
          lastSignedInAt: typeof account.lastSignedInAt === 'string'
            ? account.lastSignedInAt
            : new Date().toISOString(),
        } satisfies RecentAccount;
      })
      .filter((item): item is RecentAccount => item !== null);
  } catch {
    return [];
  }
};

const persistRecentAccounts = (accounts: RecentAccount[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(RECENT_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
};

const readAuthErrorFromLocation = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);

  const rawMessage = searchParams.get('error_description')
    ?? hashParams.get('error_description')
    ?? searchParams.get('error')
    ?? hashParams.get('error');

  if (!rawMessage) {
    return null;
  }

  return translateSupabaseError(decodeURIComponent(rawMessage.replace(/\+/g, ' ')));
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'missing-config');
  const [isCompletingAuth, setIsCompletingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>(() => readRecentAccounts());
  const [resolvedIdentity, setResolvedIdentity] = useState<ResolvedIdentityState | null>(null);
  const sessionUserId = session?.user?.id ?? null;

  const sessionIdentity = buildSessionIdentity(session?.user ?? null, resolvedIdentity ?? undefined);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive) return;

      if (error) {
        setSession(null);
        setResolvedIdentity(null);
        setStatus('unauthenticated');
        setAuthError(translateSupabaseError(error.message));
        return;
      }

      setSession(data.session);
      setResolvedIdentity(null);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    })();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setResolvedIdentity(null);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
    });

    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const locationError = readAuthErrorFromLocation();
    if (locationError) {
      setAuthError(locationError);
    }
  }, [sessionUserId]);

  const signInWithPassword = useCallback(async (input: PasswordAuthInput): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    setIsCompletingAuth(true);
    setAuthError(null);

    const { error } = await clientResult.data.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
    });

    setIsCompletingAuth(false);

    if (error) {
      const message = translateSupabaseError(error.message);
      setAuthError(message);
      return errorResult(message);
    }

    return okResult(undefined, t('Вход выполнен.', 'Signed in.'));
  }, [t]);

  const signUpWithPassword = useCallback(async (input: SignUpInput): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    setIsCompletingAuth(true);
    setAuthError(null);

    const displayName = input.displayName?.trim();
    const { data, error } = await clientResult.data.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/login`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    setIsCompletingAuth(false);

    if (error) {
      const message = translateSupabaseError(error.message);
      setAuthError(message);
      return errorResult(message);
    }

    if (!data.session) {
      return okResult(undefined, t('Аккаунт создан. Проверь почту для подтверждения.', 'Account created. Check your email to confirm it.'));
    }

    return okResult(undefined, t('Аккаунт создан, вход выполнен.', 'Account created and signed in.'));
  }, [t]);

  const sendPasswordReset = useCallback(async (email: string): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    setIsCompletingAuth(true);
    setAuthError(null);

    const { error } = await clientResult.data.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${getAppUrl()}/auth/login`,
    });

    setIsCompletingAuth(false);

    if (error) {
      const message = translateSupabaseError(error.message);
      setAuthError(message);
      return errorResult(message);
    }

    return okResult(undefined, t('Ссылка для сброса пароля отправлена.', 'Password reset link sent.'));
  }, [t]);

  const updatePassword = useCallback(async (password: string): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    setIsCompletingAuth(true);
    setAuthError(null);

    const { error } = await clientResult.data.auth.updateUser({ password });

    setIsCompletingAuth(false);

    if (error) {
      const message = translateSupabaseError(error.message);
      setAuthError(message);
      return errorResult(message);
    }

    setPasswordRecovery(false);
    return okResult(undefined, t('Пароль обновлён.', 'Password updated.'));
  }, [t]);

  const claimOwnerAdmin = useCallback(async (): Promise<ActionResult<void>> => {
    setIsCompletingAuth(true);
    setAuthError(null);

    const result = await claimOwnerAdminFromSessionRemote();

    setIsCompletingAuth(false);

    if (!result.ok) {
      setAuthError(result.error);
      return errorResult(result.error);
    }

    return okResult(undefined, result.message);
  }, []);

  const rememberResolvedIdentity = useCallback((input: { role: UserRole; isOwner?: boolean }) => {
    if (!session?.user) {
      return;
    }

    const nextIdentity = buildSessionIdentity(session.user, {
      role: input.role,
      isOwner: input.isOwner ?? input.role === 'admin',
    });

    if (!nextIdentity) {
      return;
    }

    setResolvedIdentity({
      role: nextIdentity.role ?? input.role,
      isOwner: nextIdentity.isOwner,
    });

    setRecentAccounts((prev) => {
      const nextAccounts = mergeRecentAccounts(prev, nextIdentity);
      persistRecentAccounts(nextAccounts);
      return nextAccounts;
    });
  }, [session?.user]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signOutLocal = useCallback(async (): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    setAuthError(null);
    setResolvedIdentity(null);
    setPasswordRecovery(false);

    const { error } = await clientResult.data.auth.signOut({ scope: 'local' });
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined);
  }, []);

  const signOut = useCallback(async (): Promise<ActionResult<void>> => {
    const result = await signOutLocal();
    if (!result.ok) {
      return result;
    }

    return okResult(undefined, t('Ты вышел из аккаунта.', 'You have signed out.'));
  }, [signOutLocal, t]);

  const switchAccount = useCallback(async (): Promise<ActionResult<void>> => {
    const result = await signOutLocal();
    if (!result.ok) {
      return result;
    }

    return okResult(undefined, t('Теперь можно войти другим аккаунтом.', 'You can now sign in with another account.'));
  }, [signOutLocal, t]);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    sessionIdentity,
    recentAccounts,
    isCompletingAuth,
    authError,
    passwordRecovery,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    updatePassword,
    claimOwnerAdmin,
    rememberResolvedIdentity,
    clearAuthError,
    signOut,
    switchAccount,
  }), [
    authError,
    claimOwnerAdmin,
    clearAuthError,
    isCompletingAuth,
    passwordRecovery,
    recentAccounts,
    rememberResolvedIdentity,
    sendPasswordReset,
    session,
    sessionIdentity,
    signInWithPassword,
    signOut,
    signUpWithPassword,
    status,
    switchAccount,
    updatePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
