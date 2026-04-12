export type AppLanguage = 'ru' | 'en';

export const DEFAULT_LANGUAGE: AppLanguage = 'ru';
export const LANGUAGE_STORAGE_KEY = 'pvz-schedule.language';

let currentLanguageSnapshot: AppLanguage = DEFAULT_LANGUAGE;

export const isLanguage = (value: unknown): value is AppLanguage => value === 'ru' || value === 'en';

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') {
    return currentLanguageSnapshot;
  }

  const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
};

export const getCurrentLanguage = (): AppLanguage => currentLanguageSnapshot;

export const setCurrentLanguage = (language: AppLanguage) => {
  currentLanguageSnapshot = language;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }
};

export const pickByLanguage = <T,>(language: AppLanguage, ru: T, en: T): T => (
  language === 'en' ? en : ru
);

export const pickCurrentLanguage = <T,>(ru: T, en: T): T => (
  pickByLanguage(currentLanguageSnapshot, ru, en)
);

export const getLocaleByLanguage = (language: AppLanguage): string => (
  language === 'en' ? 'en-US' : 'ru-RU'
);

export const getLanguageFlag = (language: AppLanguage): string => (
  language === 'en' ? '🇬🇧' : '🇷🇺'
);

export const MONTH_NAMES: Record<AppLanguage, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
