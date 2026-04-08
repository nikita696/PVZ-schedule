import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<ActionResult<void>>;
  signUp: (email: string, password: string) => Promise<ActionResult<void>>;
  signUpEmployee: (email: string, password: string, inviteCode: string) => Promise<ActionResult<void>>;
  signOut: () => Promise<ActionResult<void>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const claimInvite = async (inviteCode: string): Promise<ActionResult<void>> => {
  if (!supabase) {
    return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
  }

  const { error } = await supabase.rpc('claim_employee_invite', {
    invite_code_input: inviteCode,
  });

  if (error) return errorResult(translateSupabaseError(error.message));
  return okResult(undefined);
};

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
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Вход выполнен успешно.');
  };

  const signUp = async (email: string, password: string): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(
      undefined,
      'Аккаунт создан. Если в Supabase включено подтверждение email, проверьте почту.',
    );
  };

  const signUpEmployee = async (
    email: string,
    password: string,
    inviteCode: string,
  ): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (!normalizedInviteCode) {
      return errorResult('Введите инвайт-код.');
    }

    const signup = await supabase.auth.signUp({ email, password });
    if (signup.error) return errorResult(translateSupabaseError(signup.error.message));

    let hasSession = Boolean(signup.data.session);
    if (!hasSession) {
      const signin = await supabase.auth.signInWithPassword({ email, password });
      if (signin.error) {
        return okResult(
          undefined,
          'Аккаунт создан. Подтвердите email, затем войдите и привяжите инвайт-код.',
        );
      }

      hasSession = Boolean(signin.data.session);
    }

    if (!hasSession) {
      return okResult(
        undefined,
        'Аккаунт создан. Подтвердите email, затем войдите и привяжите инвайт-код.',
      );
    }

    const claimResult = await claimInvite(normalizedInviteCode);
    if (!claimResult.ok) return claimResult;

    return okResult(undefined, 'Аккаунт сотрудника создан и привязан к профилю.');
  };

  const signOut = async (): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const { error } = await supabase.auth.signOut();
    if (error) return errorResult(translateSupabaseError(error.message));

    return okResult(undefined, 'Вы успешно вышли из аккаунта.');
  };

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signUpEmployee,
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
