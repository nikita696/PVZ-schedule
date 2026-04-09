import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { activateEmployeeAccountRemote, bootstrapAdminAccountRemote } from '../data/appRepository';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';

interface RegisterAdminInput {
  email: string;
  password: string;
  organizationName: string;
  displayName: string;
}

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<ActionResult<void>>;
  registerAdmin: (input: RegisterAdminInput) => Promise<ActionResult<void>>;
  activateEmployee: (email: string, password: string) => Promise<ActionResult<void>>;
  signOut: () => Promise<ActionResult<void>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const alreadyRegisteredRegex = /already registered/i;

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

  const signIn = async (email: string, password: string): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте переменные окружения.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Вход выполнен успешно.');
  };

  const registerAdmin = async (input: RegisterAdminInput): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте переменные окружения.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error) return errorResult(translateSupabaseError(error.message));

    if (!data.session) {
      return okResult(
        undefined,
        'Аккаунт создан. Подтверди email, затем войди и заверши настройку кабинета администратора.',
      );
    }

    const bootstrapResult = await bootstrapAdminAccountRemote(
      input.organizationName.trim() || null,
      input.displayName.trim() || null,
    );
    if (!bootstrapResult.ok) {
      return bootstrapResult;
    }

    return okResult(undefined, 'Кабинет администратора создан.');
  };

  const activateEmployee = async (email: string, password: string): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте переменные окружения.');
    }

    const signUpResult = await supabase.auth.signUp({ email, password });
    if (signUpResult.error) {
      if (alreadyRegisteredRegex.test(signUpResult.error.message)) {
        const signInResult = await supabase.auth.signInWithPassword({ email, password });
        if (signInResult.error) {
          return errorResult(translateSupabaseError(signInResult.error.message));
        }
      } else {
        return errorResult(translateSupabaseError(signUpResult.error.message));
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return okResult(
        undefined,
        'Проверь почту и подтверди email. После подтверждения войди и повтори активацию.',
      );
    }

    const activationResult = await activateEmployeeAccountRemote();
    if (!activationResult.ok) return activationResult;

    return okResult(undefined, 'Аккаунт сотрудника активирован.');
  };

  const signOut = async (): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте переменные окружения.');
    }

    const { error } = await supabase.auth.signOut();
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Вы вышли из аккаунта.');
  };

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    signIn,
    registerAdmin,
    activateEmployee,
    signOut,
  }), [session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
