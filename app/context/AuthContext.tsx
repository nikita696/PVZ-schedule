import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { RecentAccount, SessionIdentity, UserRole } from '../domain/types';
import { ensureProfileFromAuthRemote } from '../data/appRepository';
import { buildSessionIdentity, mergeRecentAccounts } from '../lib/sessionIdentity';
import { pickCurrentLanguage } from '../lib/i18n';
import {
  buildYandexAuthQueryParams,
  getIncompleteYandexAuthMessage,
  getYandexAuthSuccessMessage,
  isPendingAuthFlowFresh,
  type PendingAuthFlowMode,
} from '../lib/yandexAuth';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';
import { useLanguage } from './LanguageContext';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';
type AuthRole = 'admin' | 'employee';

interface StartYandexAuthInput {
  displayName?: string;
  role?: AuthRole;
}

interface StartYandexAuthOptions {
  forceAccountSelection?: boolean;
  mode?: PendingAuthFlowMode;
}

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  sessionIdentity: SessionIdentity | null;
  recentAccounts: RecentAccount[];
  isCompletingOAuth: boolean;
  oauthError: string | null;
  startYandexAuth: (
    input?: StartYandexAuthInput,
    options?: StartYandexAuthOptions,
  ) => Promise<ActionResult<void>>;
  rememberResolvedIdentity: (input: { role: UserRole; isOwner?: boolean }) => void;
  clearOAuthError: () => void;
  signOut: () => Promise<ActionResult<void>>;
  switchAccount: () => Promise<ActionResult<void>>;
}

interface PendingYandexRegistration {
  role: AuthRole;
  displayName: string;
  createdAt: string;
}

interface PendingAuthFlow {
  mode: PendingAuthFlowMode;
  forceAccountSelection: boolean;
  startedAt: string;
}

interface ResolvedIdentityState {
  role: UserRole;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_APP_URL = 'https://pvz-schedule.vercel.app';
const DEFAULT_YANDEX_PROVIDER = 'custom:yandex';
const DEFAULT_YANDEX_SCOPES = 'login:email login:info';
const PENDING_YANDEX_STORAGE_KEY = 'pvz-schedule.pending-yandex-registration';
const RECENT_ACCOUNTS_STORAGE_KEY = 'pvz-schedule.recent-accounts';
const PENDING_AUTH_FLOW_STORAGE_KEY = 'pvz-schedule.pending-auth-flow';

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

const getAuthRedirectTo = (): string => `${getAppUrl()}/auth/login`;

const getYandexProvider = (): string => (
  import.meta.env.VITE_SUPABASE_YANDEX_PROVIDER?.trim() || DEFAULT_YANDEX_PROVIDER
);

const getYandexScopes = (): string => (
  import.meta.env.VITE_SUPABASE_YANDEX_SCOPES?.trim() || DEFAULT_YANDEX_SCOPES
);

const ensureSupabaseClient = (): ActionResult<NonNullable<typeof supabase>> => {
  if (!supabase) {
    return errorResult(pickCurrentLanguage('Supabase не настроен. Проверь переменные окружения.', 'Supabase is not configured. Check the environment variables.'));
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
  if (typeof window === 'undefined' || !input.role) {
    return;
  }

  const payload: PendingYandexRegistration = {
    role: input.role,
    displayName: input.displayName?.trim() ?? '',
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

const savePendingAuthFlow = (input: PendingAuthFlow) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PENDING_AUTH_FLOW_STORAGE_KEY, JSON.stringify(input));
};

const clearPendingAuthFlow = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_AUTH_FLOW_STORAGE_KEY);
};

const readPendingAuthFlow = (): PendingAuthFlow | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_AUTH_FLOW_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuthFlow>;
    if ((parsed.mode !== 'login' && parsed.mode !== 'switch-account') || typeof parsed.startedAt !== 'string') {
      clearPendingAuthFlow();
      return null;
    }

    if (!isPendingAuthFlowFresh(parsed.startedAt)) {
      clearPendingAuthFlow();
      return null;
    }

    return {
      mode: parsed.mode,
      forceAccountSelection: parsed.forceAccountSelection === true,
      startedAt: parsed.startedAt,
    };
  } catch {
    clearPendingAuthFlow();
    return null;
  }
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'missing-config');
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);
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
        setOAuthError(translateSupabaseError(error.message));
        return;
      }

      setSession(data.session);
      setResolvedIdentity(null);
      setStatus(data.session ? 'authenticated' : 'unauthenticated');
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setResolvedIdentity(null);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const locationError = readAuthErrorFromLocation();
    if (locationError) {
      clearPendingAuthFlow();
      setOAuthError(locationError);
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (sessionUserId) {
      clearPendingAuthFlow();
      setIsCompletingOAuth(false);
      return;
    }

    if (status !== 'unauthenticated' || isCompletingOAuth || oauthError) {
      return;
    }

    const pendingAuthFlow = readPendingAuthFlow();
    if (!pendingAuthFlow) {
      return;
    }

    clearPendingAuthFlow();
    setOAuthError(getIncompleteYandexAuthMessage(pendingAuthFlow.mode));
  }, [isCompletingOAuth, oauthError, sessionUserId, status]);

  useEffect(() => {
    if (!sessionUserId) {
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

      setOAuthError(null);
      setIsCompletingOAuth(false);
    })();

    return () => {
      isActive = false;
    };
  }, [sessionUserId]);

  const startYandexAuth = useCallback(async (
    input?: StartYandexAuthInput,
    options?: StartYandexAuthOptions,
  ): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    if (input?.role) {
      savePendingYandexRegistration(input);
    } else {
      clearPendingYandexRegistration();
    }

    setOAuthError(null);

    const shouldForceAccountSelection = options?.forceAccountSelection === true;
    savePendingAuthFlow({
      mode: options?.mode ?? 'login',
      forceAccountSelection: shouldForceAccountSelection,
      startedAt: new Date().toISOString(),
    });

    const { error } = await clientResult.data.auth.signInWithOAuth({
      provider: getYandexProvider() as never,
      options: {
        redirectTo: getAuthRedirectTo(),
        scopes: getYandexScopes(),
        queryParams: buildYandexAuthQueryParams(shouldForceAccountSelection),
      },
    });

    if (error) {
      clearPendingAuthFlow();
      clearPendingYandexRegistration();
      return errorResult(translateSupabaseError(error.message));
    }

    return okResult(undefined, getYandexAuthSuccessMessage(shouldForceAccountSelection));
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

  const clearOAuthError = useCallback(() => {
    setOAuthError(null);
  }, []);

  const signOutLocal = useCallback(async (): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    clearPendingAuthFlow();
    clearPendingYandexRegistration();
    setOAuthError(null);
    setResolvedIdentity(null);

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

  const switchAccount = useCallback(async (): Promise<ActionResult<void>> => (
    startYandexAuth(undefined, {
      forceAccountSelection: true,
      mode: 'switch-account',
    })
  ), [startYandexAuth]);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    sessionIdentity,
    recentAccounts,
    isCompletingOAuth,
    oauthError,
    startYandexAuth,
    rememberResolvedIdentity,
    clearOAuthError,
    signOut,
    switchAccount,
  }), [
    clearOAuthError,
    isCompletingOAuth,
    oauthError,
    recentAccounts,
    rememberResolvedIdentity,
    session,
    sessionIdentity,
    signOut,
    startYandexAuth,
    status,
    switchAccount,
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
