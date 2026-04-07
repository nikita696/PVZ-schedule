import type { ShiftStatusDb } from './types';

export type LegacyShiftStatus =
  | 'working'
  | 'planned-work'
  | 'worked'
  | 'day-off'
  | 'vacation'
  | 'sick'
  | 'no-show'
  | 'none';

const isValidIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getTodayIso = (now: Date): string => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeShiftStatus = (
  status: LegacyShiftStatus,
  workDate: string,
  now: Date = new Date(),
): ShiftStatusDb | null => {
  if (status === 'none') {
    return null;
  }

  if (status === 'working') {
    if (!isValidIsoDate(workDate)) {
      return 'planned-work';
    }

    const todayIso = getTodayIso(now);
    return workDate < todayIso ? 'worked' : 'planned-work';
  }

  if (
    status === 'planned-work' ||
    status === 'worked' ||
    status === 'day-off' ||
    status === 'vacation' ||
    status === 'sick' ||
    status === 'no-show'
  ) {
    return status;
  }

  return 'day-off';
};

