import type { ShiftEditorStatus, ShiftStatusDb } from './types';

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

export const SHIFT_STATUS_LABEL: Record<ShiftStatusDb, string> = {
  shift: 'Смена',
  day_off: 'Выходной',
  sick_leave: 'Больничный',
  no_show: 'Невыход',
  replacement: 'Замена',
  no_shift: 'Нет смены',
};

export const SHIFT_STATUS_BADGE_CLASS: Record<ShiftStatusDb, string> = {
  shift: 'bg-emerald-500 border-emerald-600',
  day_off: 'bg-blue-500 border-blue-600',
  sick_leave: 'bg-violet-500 border-violet-600',
  no_show: 'bg-rose-500 border-rose-600',
  replacement: 'bg-amber-400 border-amber-500',
  no_shift: 'bg-stone-200 border-stone-300',
};

export const SHIFT_STATUS_OPTIONS: Array<{
  value: ShiftEditorStatus;
  label: string;
  colorClass: string;
}> = [
  { value: 'shift', label: SHIFT_STATUS_LABEL.shift, colorClass: 'bg-emerald-500' },
  { value: 'day_off', label: SHIFT_STATUS_LABEL.day_off, colorClass: 'bg-blue-500' },
  { value: 'sick_leave', label: SHIFT_STATUS_LABEL.sick_leave, colorClass: 'bg-violet-500' },
  { value: 'no_show', label: SHIFT_STATUS_LABEL.no_show, colorClass: 'bg-rose-500' },
  { value: 'replacement', label: SHIFT_STATUS_LABEL.replacement, colorClass: 'bg-amber-400' },
  { value: 'no_shift', label: SHIFT_STATUS_LABEL.no_shift, colorClass: 'bg-stone-300' },
  { value: 'none', label: 'Очистить', colorClass: 'bg-white' },
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
