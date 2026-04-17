import type { ShiftEditorStatus, ShiftStatusDb } from './types';
import { getCurrentLanguage, pickByLanguage, type AppLanguage } from '../lib/i18n';

export type LegacyShiftStatus =
  | 'working'
  | 'planned-work'
  | 'worked'
  | 'day-off'
  | 'vacation'
  | 'sick'
  | 'no-show'
  | 'shift'
  | 'day_off'
  | 'sick_leave'
  | 'no_show'
  | 'replacement'
  | 'no_shift'
  | 'none';

export const isShiftLikeStatus = (status: ShiftStatusDb | null): status is 'shift' | 'replacement' => (
  status === 'shift' || status === 'replacement'
);

export const getShiftStatusLabel = (
  status: ShiftStatusDb | 'none',
  language: AppLanguage = getCurrentLanguage(),
): string => {
  switch (status) {
    case 'shift':
      return pickByLanguage(language, 'Смена', 'Shift');
    case 'day_off':
      return pickByLanguage(language, 'Выходной', 'Day off');
    case 'sick_leave':
      return pickByLanguage(language, 'Больничный', 'Sick leave');
    case 'no_show':
      return pickByLanguage(language, 'Невыход', 'No-show');
    case 'replacement':
      return pickByLanguage(language, 'Замена', 'Replacement');
    case 'no_shift':
      return pickByLanguage(language, 'Нет смены', 'No shift');
    case 'none':
      return pickByLanguage(language, 'Очистить', 'Clear');
    default:
      return pickByLanguage(language, 'Нет смены', 'No shift');
  }
};

export const SHIFT_STATUS_BADGE_CLASS: Record<ShiftStatusDb, string> = {
  shift: 'bg-emerald-500 border-emerald-600',
  day_off: 'bg-blue-500 border-blue-600',
  sick_leave: 'bg-violet-500 border-violet-600',
  no_show: 'bg-rose-500 border-rose-600',
  replacement: 'bg-amber-400 border-amber-500',
  no_shift: 'bg-stone-200 border-stone-300',
};

export const getShiftStatusOptions = (language: AppLanguage = getCurrentLanguage()): Array<{
  value: ShiftEditorStatus;
  label: string;
  colorClass: string;
}> => [
  { value: 'shift', label: getShiftStatusLabel('shift', language), colorClass: 'bg-emerald-500' },
  { value: 'day_off', label: getShiftStatusLabel('day_off', language), colorClass: 'bg-blue-500' },
  { value: 'sick_leave', label: getShiftStatusLabel('sick_leave', language), colorClass: 'bg-violet-500' },
  { value: 'no_show', label: getShiftStatusLabel('no_show', language), colorClass: 'bg-rose-500' },
  { value: 'replacement', label: getShiftStatusLabel('replacement', language), colorClass: 'bg-amber-400' },
  { value: 'no_shift', label: getShiftStatusLabel('no_shift', language), colorClass: 'bg-stone-300' },
  { value: 'none', label: getShiftStatusLabel('none', language), colorClass: 'bg-white' },
];

export const normalizeShiftStatus = (
  status: LegacyShiftStatus,
  workDate: string,
  now: Date = new Date(),
): ShiftStatusDb | null => {
  void now;
  if (status === 'none') {
    return null;
  }

  if (status === 'working' || status === 'planned-work' || status === 'worked') {
    void workDate;
    return 'shift';
  }

  if (status === 'day-off' || status === 'vacation' || status === 'day_off') {
    return 'day_off';
  }

  if (status === 'sick' || status === 'sick_leave') {
    return 'sick_leave';
  }

  if (status === 'no-show' || status === 'no_show') {
    return 'no_show';
  }

  if (status === 'replacement') {
    return 'replacement';
  }

  if (status === 'shift') {
    return 'shift';
  }

  if (status === 'no_shift') {
    return 'no_shift';
  }

  return 'no_shift';
};
