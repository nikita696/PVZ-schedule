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

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  isCompletingOAuth: boolean;
  oauthError: string | null;
  startYandexAuth: (input: StartYandexAuthInput) => Promise<ActionResult<void>>;
  clearOAuthError: () => void;
  signOut: () => Promise<ActionResult<void>>;
}

interface PendingYandexRegistration {
  role: AuthRole;
  displayName: string;
  createdAt: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_APP_URL = 'https://pvz-schedule.vercel.app';
const DEFAULT_YANDEX_PROVIDER = 'custom:yandex';
const DEFAULT_YANDEX_SCOPES = 'login:email login:info';
const PENDING_YANDEX_STORAGE_KEY = 'pvz-schedule.pending-yandex-registration';

const getAppUrl = (): string => {
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();

  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return DEFAULT_APP_URL;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
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
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'missing-config');
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);
  const sessionUserId = session?.user?.id ?? null;

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
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
      setOAuthError(locationError);
    }
  }, [sessionUserId]);

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

    return okResult(undefined, 'Ты вышел из аккаунта.');
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    isCompletingOAuth,
    oauthError,
    startYandexAuth,
    clearOAuthError,
    signOut,
  }), [clearOAuthError, isCompletingOAuth, oauthError, session, signOut, startYandexAuth, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
