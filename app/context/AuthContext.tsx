import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'missing-config';

interface AuthContextType {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<ActionResult<void>>;
  signUp: (email: string, password: string) => Promise<ActionResult<void>>;
  signOut: () => Promise<ActionResult<void>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    if (error) return errorResult(error.message);

    return okResult(undefined, 'Вход выполнен успешно.');
  };

  const signUp = async (email: string, password: string): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return errorResult(error.message);

    return okResult(
      undefined,
      'Аккаунт создан. Если в Supabase включено подтверждение email, проверьте почту.',
    );
  };

  const signOut = async (): Promise<ActionResult<void>> => {
    if (!supabase) {
      return errorResult('Supabase не настроен. Добавьте необходимые переменные окружения.');
    }

    const { error } = await supabase.auth.signOut();
    if (error) return errorResult(error.message);

    return okResult(undefined, 'Вы успешно вышли из аккаунта.');
  };

  const value = useMemo<AuthContextType>(() => ({
    status,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
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
