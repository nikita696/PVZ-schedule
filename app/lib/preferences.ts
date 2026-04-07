import type { UiPreferences } from '../domain/types';
import { getDefaultUiPreferences } from './date';

const PREFERENCES_STORAGE_KEY = 'pvz-schedule-ui-v1';

const isValidPreferences = (value: unknown): value is UiPreferences => {
  if (typeof value !== 'object' || value === null) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.selectedMonth === 'number' &&
    record.selectedMonth >= 1 &&
    record.selectedMonth <= 12 &&
    typeof record.selectedYear === 'number' &&
    Number.isInteger(record.selectedYear) &&
    record.selectedYear >= 2000 &&
    record.selectedYear <= 2100
  );
};

export const loadUiPreferences = (): UiPreferences => {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return getDefaultUiPreferences();

    const parsed = JSON.parse(raw) as unknown;
    return isValidPreferences(parsed) ? parsed : getDefaultUiPreferences();
  } catch {
    return getDefaultUiPreferences();
  }
};

export const saveUiPreferences = (preferences: UiPreferences): void => {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};
