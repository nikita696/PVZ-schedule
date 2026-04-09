import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { requestRegistrationRemote } from '../data/appRepository';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';

interface RegisterByEmailInput {
  email: string;
  displayName: string;
  isAdmin: boolean;
}

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  requestLoginLink: (email: string) => Promise<ActionResult<void>>;
  registerByEmail: (input: RegisterByEmailInput) => Promise<ActionResult<void>>;
  signOut: () => Promise<ActionResult<void>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EXISTING_ACCOUNT_ERRORS = new Set(['ADMIN_ALREADY_EXISTS', 'ACCOUNT_ALREADY_EXISTS']);

const getEmailRedirectTo = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/auth/login`;
};

const ensureSupabaseClient = (): ActionResult<NonNullable<typeof supabase>> => {
  if (!supabase) {
    return errorResult('Supabase не настроен. Проверь переменные окружения.');
  }

  return okResult(supabase);
};

const isAlreadyRegisteredError = (message: string) => /user already registered/i.test(message);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'missing-config');

  useEffect(() => {
    if (!supabase) return;

    let isActive = true;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isActive) return;

      if (error) {
        setSession(null);
        setStatus('unauthenticated');
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

  const sendMagicLink = useCallback(async (
    email: string,
    shouldCreateUser: boolean,
  ): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return errorResult('Укажи email.');
    }

    const signIn = async (createUser: boolean) => clientResult.data.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: createUser,
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    let { error } = await signIn(shouldCreateUser);

    if (error && shouldCreateUser && isAlreadyRegisteredError(error.message)) {
      ({ error } = await signIn(false));
    }

    if (error) {
      return errorResult(translateSupabaseError(error.message));
    }

    return okResult(undefined, 'Ссылка для входа отправлена на почту.');
  }, []);

  const requestLoginLink = useCallback(async (email: string): Promise<ActionResult<void>> => (
    sendMagicLink(email, false)
  ), [sendMagicLink]);

  const registerByEmail = useCallback(async (input: RegisterByEmailInput): Promise<ActionResult<void>> => {
    const role = input.isAdmin ? 'admin' : 'employee';
    const registrationResult = await requestRegistrationRemote({
      email: input.email,
      role,
      displayName: input.displayName.trim() || null,
    });

    if (!registrationResult.ok) {
      if (EXISTING_ACCOUNT_ERRORS.has(registrationResult.error)) {
        const loginResult = await sendMagicLink(input.email, false);
        if (loginResult.ok) {
          return okResult(undefined, 'Аккаунт уже существует. Я отправил ссылку для входа на почту.');
        }
      }

      return registrationResult;
    }

    const linkResult = await sendMagicLink(input.email, true);
    if (!linkResult.ok) {
      return linkResult;
    }

    return okResult(
      undefined,
      input.isAdmin
        ? 'Регистрация администратора начата. Проверь почту.'
        : 'Регистрация сотрудника начата. Проверь почту.',
    );
  }, [sendMagicLink]);

  const signOut = useCallback(async (): Promise<ActionResult<void>> => {
    const clientResult = ensureSupabaseClient();
    if (!clientResult.ok) return clientResult;

    const { error } = await clientResult.data.auth.signOut();
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Ты вышел из аккаунта.');
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    requestLoginLink,
    registerByEmail,
    signOut,
  }), [registerByEmail, requestLoginLink, session, signOut, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
