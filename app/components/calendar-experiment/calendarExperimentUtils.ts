import { isShiftLikeStatus } from '../../domain/shiftStatus';
import type { Employee, Shift, ShiftStatusDb } from '../../domain/types';
import type { AppLanguage } from '../../lib/i18n';
import { MONTH_NAMES, pickByLanguage } from '../../lib/i18n';

export interface DayIssueSummary {
  coverage: boolean;
  conflict: boolean;
  noShow: boolean;
  total: number;
  label: string | null;
  tone: 'danger' | 'warning' | 'attention' | 'neutral';
}

export interface CalendarGridDay {
  date: string;
  dayNumber: number;
  month: number;
  year: number;
  weekday: number;
  weekend: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  shiftLikeCount: number;
  issues: DayIssueSummary;
}

export const CALENDAR_WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

export const STATUS_SURFACE_CLASS: Record<ShiftStatusDb, string> = {
  shift: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  day_off: 'border-sky-200 bg-sky-50 text-sky-700',
  sick_leave: 'border-violet-200 bg-violet-50 text-violet-700',
  no_show: 'border-rose-200 bg-rose-50 text-rose-700',
  replacement: 'border-amber-200 bg-amber-50 text-amber-800',
  no_shift: 'border-stone-200 bg-stone-100 text-stone-600',
};

export const getShiftKey = (employeeId: string, date: string): string => `${employeeId}:${date}`;

export const buildShiftLookup = (shifts: Shift[]): Map<string, Shift> => (
  new Map(shifts.map((shift) => [getShiftKey(shift.employeeId, shift.date), shift]))
);

export const isoDate = (year: number, month: number, day: number): string => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const normalizeDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

export const getEffectiveShiftStatus = (shift: Shift | undefined): ShiftStatusDb => (
  shift?.actualStatus ?? shift?.approvedStatus ?? shift?.requestedStatus ?? shift?.status ?? 'no_shift'
);

export const isOutsideEmployment = (employee: Employee, dayDate: string): boolean => {
  const hiredAt = normalizeDateKey(employee.hiredAt);
  const terminatedAt = normalizeDateKey(employee.terminatedAt);

  if (hiredAt && dayDate < hiredAt) return true;
  if (terminatedAt && dayDate > terminatedAt) return true;
  return false;
};

export const formatMonthHeading = (language: AppLanguage, month: number, year: number): string => (
  `${MONTH_NAMES[language][month - 1]} ${year}`
);

export const getEmployeeShortName = (name: string, maxLength = 3): string => {
  const firstChunk = name.trim().split(/\s+/)[0] ?? name.trim();
  return firstChunk.slice(0, Math.max(1, maxLength));
};

export const getStatusCompactLabel = (status: ShiftStatusDb, language: AppLanguage): string => {
  switch (status) {
    case 'shift':
      return pickByLanguage(language, 'См', 'Sh');
    case 'day_off':
      return pickByLanguage(language, 'Вых', 'Off');
    case 'sick_leave':
      return pickByLanguage(language, 'Бол', 'Sick');
    case 'no_show':
      return pickByLanguage(language, 'Нев', 'No');
    case 'replacement':
      return pickByLanguage(language, 'Зам', 'Rep');
    case 'no_shift':
      return pickByLanguage(language, '—', '—');
    default:
      return pickByLanguage(language, '—', '—');
  }
};

export const getDayIssues = (
  date: string,
  employees: Employee[],
  shiftLookup: Map<string, Shift>,
  language: AppLanguage,
): DayIssueSummary => {
  const eligibleEmployees = employees.filter((employee) => !isOutsideEmployment(employee, date));

  let shiftLikeCount = 0;
  let noShowCount = 0;

  for (const employee of eligibleEmployees) {
    const status = getEffectiveShiftStatus(shiftLookup.get(getShiftKey(employee.id, date)));
    if (isShiftLikeStatus(status)) {
      shiftLikeCount += 1;
    }
    if (status === 'no_show') {
      noShowCount += 1;
    }
  }

  const coverage = eligibleEmployees.length > 0 && shiftLikeCount === 0;
  const conflict = shiftLikeCount > 1;
  const noShow = noShowCount > 0;
  const total = Number(coverage) + Number(conflict) + Number(noShow);

  if (conflict) {
    return {
      coverage,
      conflict,
      noShow,
      total,
      label: pickByLanguage(language, 'Конфликт', 'Conflict'),
      tone: 'warning',
    };
  }

  if (coverage) {
    return {
      coverage,
      conflict,
      noShow,
      total,
      label: pickByLanguage(language, 'Нет смены', 'No coverage'),
      tone: 'danger',
    };
  }

  if (noShow) {
    return {
      coverage,
      conflict,
      noShow,
      total,
      label: pickByLanguage(language, 'Невыход', 'No-show'),
      tone: 'attention',
    };
  }

  return {
    coverage,
    conflict,
    noShow,
    total,
    label: null,
    tone: 'neutral',
  };
};

export const buildCalendarGridDays = (
  year: number,
  month: number,
  employees: Employee[],
  shiftLookup: Map<string, Shift>,
  language: AppLanguage,
  today = new Date(),
): CalendarGridDay[] => {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const mondayFirstOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStartDate = new Date(year, month - 1, 1 - mondayFirstOffset);
  const todayKey = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = new Date(gridStartDate);
    currentDate.setDate(gridStartDate.getDate() + index);

    const dayYear = currentDate.getFullYear();
    const dayMonth = currentDate.getMonth() + 1;
    const dayNumber = currentDate.getDate();
    const date = isoDate(dayYear, dayMonth, dayNumber);
    const weekday = (currentDate.getDay() + 6) % 7;

    let shiftLikeCount = 0;
    for (const employee of employees) {
      if (isOutsideEmployment(employee, date)) continue;
      const status = getEffectiveShiftStatus(shiftLookup.get(getShiftKey(employee.id, date)));
      if (isShiftLikeStatus(status)) {
        shiftLikeCount += 1;
      }
    }

    return {
      date,
      dayNumber,
      month: dayMonth,
      year: dayYear,
      weekday,
      weekend: weekday >= 5,
      isToday: date === todayKey,
      isCurrentMonth: dayMonth === month && dayYear === year,
      shiftLikeCount,
      issues: getDayIssues(date, employees, shiftLookup, language),
    };
  });
};
