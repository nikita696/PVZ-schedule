import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { ensureProfileFromAuthRemote } from '../data/appRepository';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';
type AuthRole = 'admin' | 'employee';

interface StartYandexAuthInput {
  displayName: string;
  role: AuthRole;
}

interface RememberedAccount {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: AuthRole | null;
  accessToken: string;
  refreshToken: string;
  lastUsedAt: string;
}

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  isCompletingOAuth: boolean;
  oauthError: string | null;
  rememberedAccounts: RememberedAccount[];
  startYandexAuth: (input: StartYandexAuthInput) => Promise<ActionResult<void>>;
  switchRememberedAccount: (accountId: string) => Promise<ActionResult<{ role: AuthRole | null }>>;
  forgetRememberedAccount: (accountId: string) => void;
  clearOAuthError: () => void;
  signOut: () => Promise<ActionResult<void>>;
  signOutAll: () => Promise<ActionResult<void>>;
}

interface PendingYandexRegistration {
  role: AuthRole;
  displayName: string;
  createdAt: string;
}

type UserMetadata = Record<string, unknown>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_APP_URL = 'https://pvz-schedule.vercel.app';
const DEFAULT_YANDEX_PROVIDER = 'custom:yandex';
const DEFAULT_YANDEX_SCOPES = 'login:email login:info';
const PENDING_YANDEX_STORAGE_KEY = 'pvz-schedule.pending-yandex-registration';
const REMEMBERED_ACCOUNTS_STORAGE_KEY = 'pvz-schedule.remembered-accounts';
const MAX_REMEMBERED_ACCOUNTS = 5;

const getAppUrl = (): string => {
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();

  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return DEFAULT_APP_URL;
};

const getAuthRedirectTo = (): string => `${getAppUrl()}/auth/login`;

const getYandexProvider = (): string => (
  import.meta.env.VITE_SUPABASE_YANDEX_PROVIDER?.trim() || DEFAULT_YANDEX_PROVIDER
);

const getYandexScopes = (): string => (
  import.meta.env.VITE_SUPABASE_YANDEX_SCOPES?.trim() || DEFAULT_YANDEX_SCOPES
);

const ensureSupabaseClient = (): ActionResult<NonNullable<typeof supabase>> => {
  if (!supabase) {
    return errorResult('Supabase не настроен. Проверь переменные окружения.');
  }

  return okResult(supabase);
};

const readPendingYandexRegistration = (): PendingYandexRegistration | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(PENDING_YANDEX_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingYandexRegistration>;
    if (parsed.role !== 'admin' && parsed.role !== 'employee') {
      return null;
    }

    return {
      role: parsed.role,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const savePendingYandexRegistration = (input: StartYandexAuthInput) => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: PendingYandexRegistration = {
    role: input.role,
    displayName: input.displayName.trim(),
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(PENDING_YANDEX_STORAGE_KEY, JSON.stringify(payload));
};

const clearPendingYandexRegistration = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PENDING_YANDEX_STORAGE_KEY);
};

const isRememberedAccount = (value: unknown): value is RememberedAccount => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  const validRole = record.role === null || record.role === 'admin' || record.role === 'employee';

  return typeof record.id === 'string'
    && typeof record.userId === 'string'
    && typeof record.email === 'string'
    && typeof record.displayName === 'string'
    && (record.avatarUrl === null || typeof record.avatarUrl === 'string')
    && validRole
    && typeof record.accessToken === 'string'
    && typeof record.refreshToken === 'string'
    && typeof record.lastUsedAt === 'string';
};

const normalizeRememberedAccounts = (accounts: RememberedAccount[]): RememberedAccount[] => {
  const deduped = new Map<string, RememberedAccount>();

  for (const account of accounts) {
    const existing = deduped.get(account.userId);
    if (!existing) {
      deduped.set(account.userId, account);
      continue;
    }

    deduped.set(account.userId, {
      ...existing,
      ...account,
      role: account.role ?? existing.role ?? null,
      displayName: account.displayName || existing.displayName,
      avatarUrl: account.avatarUrl ?? existing.avatarUrl,
      lastUsedAt: account.lastUsedAt >= existing.lastUsedAt ? account.lastUsedAt : existing.lastUsedAt,
    });
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt))
    .slice(0, MAX_REMEMBERED_ACCOUNTS);
};

const readRememberedAccounts = (): RememberedAccount[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(REMEMBERED_ACCOUNTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeRememberedAccounts(parsed.filter(isRememberedAccount));
  } catch {
    return [];
  }
};

const writeRememberedAccounts = (accounts: RememberedAccount[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (accounts.length === 0) {
    window.localStorage.removeItem(REMEMBERED_ACCOUNTS_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    REMEMBERED_ACCOUNTS_STORAGE_KEY,
    JSON.stringify(normalizeRememberedAccounts(accounts)),
  );
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

const getUserMetadata = (session: Session): UserMetadata => (
  session.user.user_metadata && typeof session.user.user_metadata === 'object'
    ? session.user.user_metadata as UserMetadata
    : {}
);

const firstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const buildRememberedAccount = (
  session: Session,
  role: AuthRole | null,
  fallbackDisplayName = '',
): RememberedAccount => {
  const userMetadata = getUserMetadata(session);
  const displayName = firstNonEmptyString(
    fallbackDisplayName,
    userMetadata.full_name,
    userMetadata.name,
    userMetadata.display_name,
    session.user.email?.split('@')[0],
    session.user.email,
  ) || 'Аккаунт';

  const avatarUrl = firstNonEmptyString(
    userMetadata.avatar_url,
    userMetadata.picture,
    userMetadata.image,
  ) || null;

  return {
    id: session.user.id,
    userId: session.user.id,
    email: session.user.email ?? '',
    displayName,
    avatarUrl,
    role,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    lastUsedAt: new Date().toISOString(),
  };
};

const upsertRememberedAccount = (
  accounts: RememberedAccount[],
  nextAccount: RememberedAccount,
): RememberedAccount[] => {
  const existing = accounts.find((account) => account.userId === nextAccount.userId);

  const merged: RememberedAccount = existing
    ? {
        ...existing,
        ...nextAccount,
        role: nextAccount.role ?? existing.role ?? null,
        displayName: nextAccount.displayName || existing.displayName,
        avatarUrl: nextAccount.avatarUrl ?? existing.avatarUrl,
        email: nextAccount.email || existing.email,
      }
    : nextAccount;

  return normalizeRememberedAccounts([
    merged,
    ...accounts.filter((account) => account.userId !== nextAccount.userId),
  ]);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'missing-config');
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>(() => readRememberedAccounts());
  const sessionUserId = session?.user?.id ?? null;

  const rememberSession = useCallback((
    nextSession: Session,
    role: AuthRole | null,
    fallbackDisplayName = '',
  ) => {
    setRememberedAccounts((prev) => (
      upsertRememberedAccount(prev, buildRememberedAccount(nextSession, role, fallbackDisplayName))
    ));
  }, []);

  useEffect(() => {
    writeRememberedAccounts(rememberedAccounts);
  }, [rememberedAccounts]);

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
        setStatus('unauthenticated');
        setOAuthError(translateSupabaseError(error.message));
        return;
      }

      setSession(data.session);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');

      if (data.session) {
        setRememberedAccounts((prev) => {
          const existing = prev.find((account) => account.userId === data.session!.user.id);
          return upsertRememberedAccount(
            prev,
            buildRememberedAccount(
              data.session,
              existing?.role ?? null,
              existing?.displayName ?? '',
            ),
          );
        });
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');

      if (!nextSession) {
        return;
      }

      setRememberedAccounts((prev) => {
        const existing = prev.find((account) => account.userId === nextSession.user.id);
        return upsertRememberedAccount(
          prev,
          buildRememberedAccount(
            nextSession,
            existing?.role ?? null,
            existing?.displayName ?? '',
          ),
        );
      });
    });

    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const locationError = readAuthErrorFromLocation();
    if (locationError) {
      setOAuthError(locationError);
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !session) {
      setIsCompletingOAuth(false);
      return;
    }

    const pendingRegistration = readPendingYandexRegistration();
    if (!pendingRegistration) {
      setIsCompletingOAuth(false);
      return;
    }

    let isActive = true;
    setIsCompletingOAuth(true);
    setOAuthError(null);

    void (async () => {
      const result = await ensureProfileFromAuthRemote({
        desiredRole: pendingRegistration.role,
        displayName: pendingRegistration.displayName,
      });

      if (!isActive) {
        return;
      }

      clearPendingYandexRegistration();

      if (!result.ok) {
        setOAuthError(result.error);
        setIsCompletingOAuth(false);
        return;
      }

      rememberSession(session, result.data.role, pendingRegistration.displayName);
      setOAuthError(null);
      setIsCompletingOAuth(false);
    })();

    return () => {
      isActive = false;
    };
  }, [rememberSession, session, sessionUserId]);

  const startYandexAuth = useCallback(async (input: StartYandexAuthInput): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    savePendingYandexRegistration(input);
    setOAuthError(null);

    const { error } = await clientResult.data.auth.signInWithOAuth({
      provider: getYandexProvider() as never,
      options: {
        redirectTo: getAuthRedirectTo(),
        scopes: getYandexScopes(),
      },
    });

    if (error) {
      clearPendingYandexRegistration();
      return errorResult(translateSupabaseError(error.message));
    }

    return okResult(undefined, 'Открываю вход через Яндекс ID...');
  }, []);

  const switchRememberedAccount = useCallback(async (accountId: string): Promise<ActionResult<{ role: AuthRole | null }>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    const account = rememberedAccounts.find((item) => item.id === accountId || item.userId === accountId);
    if (!account) {
      return errorResult('Этот аккаунт не найден в списке.');
    }

    clearPendingYandexRegistration();
    setOAuthError(null);

    const { data, error } = await clientResult.data.auth.setSession({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    if (error) {
      return errorResult(translateSupabaseError(error.message));
    }

    if (data.session) {
      rememberSession(data.session, account.role, account.displayName);
    }

    return okResult(
      { role: account.role ?? null },
      account.displayName ? `Переключаю на ${account.displayName}.` : 'Переключаю аккаунт.',
    );
  }, [rememberSession, rememberedAccounts]);

  const forgetRememberedAccount = useCallback((accountId: string) => {
    setRememberedAccounts((prev) => (
      prev.filter((account) => account.id !== accountId && account.userId !== accountId)
    ));
  }, []);

  const clearOAuthError = useCallback(() => {
    setOAuthError(null);
  }, []);

  const signOut = useCallback(async (): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    clearPendingYandexRegistration();
    setOAuthError(null);

    const { error } = await clientResult.data.auth.signOut();
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Ты вышел из текущего аккаунта.');
  }, []);

  const signOutAll = useCallback(async (): Promise<ActionResult<void>> => {
    const signOutResult = await signOut();
    if (!signOutResult.ok) {
      return signOutResult;
    }

    setRememberedAccounts([]);
    return okResult(undefined, 'Все сохранённые аккаунты удалены.');
  }, [signOut]);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    isCompletingOAuth,
    oauthError,
    rememberedAccounts,
    startYandexAuth,
    switchRememberedAccount,
    forgetRememberedAccount,
    clearOAuthError,
    signOut,
    signOutAll,
  }), [
    clearOAuthError,
    forgetRememberedAccount,
    isCompletingOAuth,
    oauthError,
    rememberedAccounts,
    session,
    signOut,
    signOutAll,
    startYandexAuth,
    status,
    switchRememberedAccount,
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
