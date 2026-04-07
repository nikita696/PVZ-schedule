import type { UiPreferences } from '../domain/types';

export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

export const isValidDateString = (value: unknown): value is string => (
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
);

export const isDateOnOrBeforeToday = (date: Date): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return date <= today;
};

export const getLocalISODate = (): string => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const getDefaultUiPreferences = (): UiPreferences => {
  const now = new Date();
  return {
    selectedMonth: now.getMonth() + 1,
    selectedYear: now.getFullYear(),
  };
};
