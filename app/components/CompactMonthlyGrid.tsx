import { useMemo, useState } from 'react';
import type { Employee, Shift, ShiftEditorStatus, ShiftStatusDb } from '../domain/types';
import {
  getShiftStatusLabel,
  getShiftStatusOptions,
  isShiftLikeStatus,
} from '../domain/shiftStatus';
import { useLanguage } from '../context/LanguageContext';
import { pickByLanguage, type AppLanguage } from '../lib/i18n';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

interface CompactMonthlyGridProps {
  employees: Employee[];
  shifts: Shift[];
  month: number;
  year: number;
  editable: boolean;
  editableEmployeeIds?: string[];
  onStatusChange?: (employeeId: string, date: string, status: ShiftEditorStatus) => void;
}

interface DayMeta {
  date: string;
  dayNumber: number;
  weekdayLabel: string;
  weekend: boolean;
  isToday: boolean;
  holidayName: string | null;
}

interface StatusCellMeta {
  abbr: Record<AppLanguage, string>;
  className: string;
  markerClassName: string;
}

const HOLIDAY_BY_MONTH_DAY: Record<string, { ru: string; en: string }> = {
  '01-01': { ru: 'Новый год', en: 'New Year' },
  '01-02': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '01-03': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '01-04': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '01-05': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '01-06': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '01-07': { ru: 'Рождество', en: 'Christmas' },
  '01-08': { ru: 'Новогодние каникулы', en: 'New Year holidays' },
  '02-23': { ru: 'День защитника Отечества', en: 'Defender of the Fatherland Day' },
  '03-08': { ru: 'Международный женский день', en: 'International Women’s Day' },
  '05-01': { ru: 'Праздник Весны и Труда', en: 'Spring and Labour Day' },
  '05-09': { ru: 'День Победы', en: 'Victory Day' },
  '06-12': { ru: 'День России', en: 'Russia Day' },
  '11-04': { ru: 'День народного единства', en: 'National Unity Day' },
};

const WEEKDAY_LABELS: Record<AppLanguage, string[]> = {
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const STATUS_CELL_META: Record<ShiftStatusDb, StatusCellMeta> = {
  shift: {
    abbr: { ru: 'С', en: 'S' },
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    markerClassName: 'bg-emerald-500',
  },
  day_off: {
    abbr: { ru: 'В', en: 'O' },
    className: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100',
    markerClassName: 'bg-sky-500',
  },
  sick_leave: {
    abbr: { ru: 'Б', en: 'L' },
    className: 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100',
    markerClassName: 'bg-violet-500',
  },
  no_show: {
    abbr: { ru: 'Н', en: 'N' },
    className: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
    markerClassName: 'bg-rose-500',
  },
  replacement: {
    abbr: { ru: 'З', en: 'R' },
    className: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    markerClassName: 'bg-amber-400',
  },
  no_shift: {
    abbr: { ru: '-', en: '-' },
    className: 'border-stone-200 bg-white text-stone-300 hover:bg-stone-50',
    markerClassName: 'bg-stone-300',
  },
};

const isoDate = (year: number, month: number, day: number): string => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const normalizeDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

const isOutsideEmployment = (employee: Employee, dayDate: string): boolean => {
  const hiredAt = normalizeDateKey(employee.hiredAt);
  const terminatedAt = normalizeDateKey(employee.terminatedAt);
  if (hiredAt && dayDate < hiredAt) return true;
  if (terminatedAt && dayDate > terminatedAt) return true;
  return false;
};

const getEffectiveShiftStatus = (shift: Shift | undefined): ShiftStatusDb => (
  shift?.actualStatus ?? shift?.approvedStatus ?? shift?.requestedStatus ?? shift?.status ?? 'no_shift'
);

const getHolidayName = (month: number, day: number, language: AppLanguage): string | null => {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holiday = HOLIDAY_BY_MONTH_DAY[key];
  return holiday ? pickByLanguage(language, holiday.ru, holiday.en) : null;
};

const getCellKey = (employeeId: string, date: string): string => `${employeeId}:${date}`;

export function CompactMonthlyGrid({
  employees,
  shifts,
  month,
  year,
  editable,
  editableEmployeeIds,
  onStatusChange,
}: CompactMonthlyGridProps) {
  const { language, t } = useLanguage();
  const [openCellKey, setOpenCellKey] = useState<string | null>(null);

  const statusOptions = useMemo(() => getShiftStatusOptions(language), [language]);
  const storedStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.value !== 'none'),
    [statusOptions],
  );

  const dayMeta = useMemo<DayMeta[]>(() => {
    const now = new Date();
    const todayKey = isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = isoDate(year, month, dayNumber);
      const weekday = new Date(year, month - 1, dayNumber).getDay();

      return {
        date,
        dayNumber,
        weekdayLabel: WEEKDAY_LABELS[language][weekday],
        weekend: weekday === 0 || weekday === 6,
        isToday: date === todayKey,
        holidayName: getHolidayName(month, dayNumber, language),
      };
    });
  }, [language, month, year]);

  const dayDateSet = useMemo(() => new Set(dayMeta.map((day) => day.date)), [dayMeta]);

  const shiftLookup = useMemo(() => {
    const lookup = new Map<string, Shift>();

    for (const shift of shifts) {
      if (!dayDateSet.has(shift.date)) continue;
      lookup.set(getCellKey(shift.employeeId, shift.date), shift);
    }

    return lookup;
  }, [dayDateSet, shifts]);

  const editableEmployeeIdSet = useMemo(() => {
    if (!editableEmployeeIds) {
      return new Set(employees.map((employee) => employee.id));
    }

    return new Set(editableEmployeeIds);
  }, [editableEmployeeIds, employees]);

  const workedCountByEmployee = useMemo(() => {
    const counts = new Map<string, number>();

    for (const employee of employees) {
      counts.set(employee.id, 0);
    }

    for (const shift of shifts) {
      if (!dayDateSet.has(shift.date) || !isShiftLikeStatus(getEffectiveShiftStatus(shift))) continue;
      counts.set(shift.employeeId, (counts.get(shift.employeeId) ?? 0) + 1);
    }

    return counts;
  }, [dayDateSet, employees, shifts]);

  const unfilledDays = useMemo(() => dayMeta.filter((day) => {
    const eligibleEmployees = employees.filter((employee) => !isOutsideEmployment(employee, day.date));
    if (eligibleEmployees.length === 0) return false;

    return !eligibleEmployees.some((employee) => {
      const status = getEffectiveShiftStatus(shiftLookup.get(getCellKey(employee.id, day.date)));
      return isShiftLikeStatus(status);
    });
  }), [dayMeta, employees, shiftLookup]);

  const totalShiftLikeCount = useMemo(() => (
    Array.from(workedCountByEmployee.values()).reduce((sum, count) => sum + count, 0)
  ), [workedCountByEmployee]);

  const gridTemplateColumns = useMemo(
    () => `minmax(13.5rem, 14rem) repeat(${dayMeta.length}, minmax(2.25rem, 1fr))`,
    [dayMeta.length],
  );

  const applyStatus = (employee: Employee, day: DayMeta, status: ShiftEditorStatus) => {
    if (!editable || !onStatusChange || !editableEmployeeIdSet.has(employee.id)) return;
    if (isOutsideEmployment(employee, day.date)) return;

    onStatusChange(employee.id, day.date, status);
    setOpenCellKey(null);
  };

  return (
    <div data-testid="monthly-schedule-table-shell" className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border bg-stone-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-stone-900">
            {t('График на месяц', 'Monthly schedule')}
          </div>
          <div className="mt-0.5 text-xs text-stone-600">
            {t(
              'Сотрудники слева, дни сверху. Клик по доступной ячейке открывает выбор статуса.',
              'Employees are on the left, days are on top. Click an editable cell to choose a status.',
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {storedStatusOptions.map((status) => {
            const statusValue = status.value as ShiftStatusDb;
            const statusMeta = STATUS_CELL_META[statusValue];

            return (
              <span
                key={status.value}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700"
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', statusMeta.markerClassName)} />
                {status.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border bg-white p-3 text-xs text-stone-700 sm:grid-cols-3">
        <div>
          <span className="font-semibold text-stone-900">{employees.length}</span>{' '}
          {t('сотрудников в таблице', 'employees in the table')}
        </div>
        <div>
          <span className="font-semibold text-stone-900">{totalShiftLikeCount}</span>{' '}
          {t('смен в месяце', 'shifts this month')}
        </div>
        <div data-testid="schedule-uncovered-days" className="truncate">
          <span className="font-semibold text-stone-900">{t('Непокрытые дни:', 'Uncovered days:')}</span>{' '}
          {unfilledDays.length === 0 ? t('нет', 'none') : unfilledDays.map((day) => day.dayNumber).join(', ')}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div data-testid="monthly-schedule-scroll" className="max-h-[62vh] overflow-auto">
          <div className="min-w-[1340px]">
            <div
              data-testid="monthly-schedule-header-days"
              className="sticky top-0 z-20 grid border-b border-stone-200 bg-stone-50"
              style={{ gridTemplateColumns }}
            >
              <div className="sticky left-0 z-30 flex h-14 items-center border-r border-stone-200 bg-stone-50 px-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t('Сотрудник', 'Employee')}
              </div>

              {dayMeta.map((day) => (
                <div
                  key={day.date}
                  data-date={day.date}
                  className={cn(
                    'flex h-14 flex-col items-center justify-center border-r border-stone-200 text-center last:border-r-0',
                    day.weekend || day.holidayName ? 'bg-stone-100/80 text-stone-500' : 'text-stone-700',
                    day.isToday ? 'shadow-[inset_0_-2px_0_0_rgb(251_146_60)]' : '',
                  )}
                  title={day.holidayName ?? undefined}
                >
                  <span className="text-sm font-semibold leading-none">{day.dayNumber}</span>
                  <span className="mt-1 text-[10px] font-semibold uppercase leading-none text-stone-400">
                    {day.weekdayLabel}
                  </span>
                </div>
              ))}
            </div>

            <div>
              {employees.map((employee, employeeIndex) => (
                <div
                  key={employee.id}
                  data-testid="monthly-schedule-row"
                  data-employee-id={employee.id}
                  className="grid border-b border-stone-100 last:border-b-0"
                  style={{ gridTemplateColumns }}
                >
                  <div className="sticky left-0 z-10 flex min-h-16 items-center gap-3 border-r border-stone-200 bg-white px-4 py-3 shadow-[6px_0_12px_-12px_rgba(15,23,42,0.35)]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-sm font-semibold text-stone-600">
                      {employee.isOwner ? employee.name.trim().slice(0, 1) : employeeIndex + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-stone-900" title={employee.name}>
                        {employee.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-500">
                        <span>{employee.isOwner ? t('владелец', 'owner') : t('сотрудник', 'employee')}</span>
                        <span className="h-1 w-1 rounded-full bg-stone-300" />
                        <span>
                          {workedCountByEmployee.get(employee.id) ?? 0} {t('смен', 'shifts')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {dayMeta.map((day) => {
                    const cellKey = getCellKey(employee.id, day.date);
                    const shift = shiftLookup.get(cellKey);
                    const status = getEffectiveShiftStatus(shift);
                    const statusMeta = STATUS_CELL_META[status];
                    const outsideEmployment = isOutsideEmployment(employee, day.date);
                    const canEditCell = editable
                      && !!onStatusChange
                      && editableEmployeeIdSet.has(employee.id)
                      && !outsideEmployment;
                    const label = getShiftStatusLabel(status, language);

                    const cellButton = (
                      <button
                        type="button"
                        data-testid={`shift-cell-${employee.id}-${day.date}`}
                        data-employee-id={employee.id}
                        data-date={day.date}
                        data-status={status}
                        data-has-record={shift ? 'true' : 'false'}
                        disabled={!canEditCell}
                        aria-label={`${employee.name}, ${day.dayNumber}.${String(month).padStart(2, '0')}.${year}: ${label}`}
                        title={outsideEmployment ? t('Сотрудник вне периода работы', 'Employee is outside employment range') : label}
                        className={cn(
                          'm-1 flex h-9 min-w-8 items-center justify-center rounded-lg border text-[11px] font-bold transition',
                          outsideEmployment
                            ? 'cursor-not-allowed border-dashed border-stone-200 bg-stone-50 text-stone-300'
                            : statusMeta.className,
                          canEditCell
                            ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-orange-300'
                            : 'cursor-default disabled:opacity-100',
                          day.isToday && !outsideEmployment ? 'ring-1 ring-orange-300' : '',
                        )}
                      >
                        {outsideEmployment ? '' : statusMeta.abbr[language]}
                      </button>
                    );

                    return (
                      <div
                        key={cellKey}
                        className={cn(
                          'min-h-12 border-r border-stone-100 last:border-r-0',
                          day.weekend || day.holidayName ? 'bg-stone-50/70' : 'bg-white',
                        )}
                      >
                        <Popover
                          open={openCellKey === cellKey && canEditCell}
                          onOpenChange={(nextOpen) => setOpenCellKey(nextOpen ? cellKey : null)}
                        >
                          <PopoverTrigger asChild>
                            {cellButton}
                          </PopoverTrigger>

                          {canEditCell ? (
                            <PopoverContent
                              align="start"
                              className="w-56 p-2"
                              data-testid="shift-status-popover"
                            >
                              <div className="mb-2 border-b border-stone-100 px-2 pb-2 text-xs">
                                <div className="font-semibold text-stone-900">{employee.name}</div>
                                <div className="text-stone-500">
                                  {day.dayNumber}.{String(month).padStart(2, '0')}.{year}
                                </div>
                              </div>
                              <div className="grid gap-1">
                                {statusOptions.map((option) => {
                                  const optionStatus = option.value === 'none' ? null : STATUS_CELL_META[option.value as ShiftStatusDb];

                                  return (
                                    <button
                                      key={`${cellKey}:${option.value}`}
                                      type="button"
                                      data-testid={`shift-option-${option.value}`}
                                      onClick={() => applyStatus(employee, day, option.value)}
                                      className={cn(
                                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-stone-100',
                                        option.value === status ? 'bg-stone-100 font-semibold text-stone-900' : 'text-stone-700',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'h-3.5 w-3.5 rounded-full border border-stone-300',
                                          optionStatus ? optionStatus.markerClassName : 'bg-white',
                                        )}
                                      />
                                      <span>{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          ) : null}
                        </Popover>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
