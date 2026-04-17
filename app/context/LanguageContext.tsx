import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getCurrentLanguage,
  getLanguageFlag,
  getLocaleByLanguage,
  getStoredLanguage,
  pickByLanguage,
  setCurrentLanguage,
  type AppLanguage,
} from '../lib/i18n';

interface LanguageContextType {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: <T,>(ru: T, en: T) => T;
  flag: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === 'undefined') {
      return getCurrentLanguage();
    }

    return getStoredLanguage();
  });

  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    locale: getLocaleByLanguage(language),
    setLanguage: setLanguageState,
    toggleLanguage: () => setLanguageState((prev) => (prev === 'ru' ? 'en' : 'ru')),
    t: <T,>(ru: T, en: T) => pickByLanguage(language, ru, en),
    flag: getLanguageFlag(language),
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}

export type { AppLanguage };
