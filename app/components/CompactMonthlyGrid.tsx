import { useEffect, useMemo, useState } from 'react';
import type { Employee, Shift, ShiftStatus } from '../domain/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

interface CompactMonthlyGridProps {
  employees: Employee[];
  shifts: Shift[];
  month: number;
  year: number;
  editable: boolean;
  onStatusChange?: (employeeId: string, date: string, status: ShiftStatus) => void;
}

interface DayMeta {
  date: string;
  dayNumber: number;
  weekend: boolean;
  isToday: boolean;
  holidayName: string | null;
}

type ActiveEmployeeId = 'all' | string;

interface StatusOption {
  value: ShiftStatus;
  label: string;
  colorClass: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'worked', label: 'Рабочий', colorClass: 'bg-emerald-500' },
  { value: 'day-off', label: 'Выходной', colorClass: 'bg-blue-500' },
  { value: 'sick', label: 'Больничный', colorClass: 'bg-violet-500' },
  { value: 'no-show', label: 'Невыход', colorClass: 'bg-rose-500' },
  { value: 'vacation', label: 'Отпуск', colorClass: 'bg-yellow-400' },
  { value: 'planned-work', label: 'Подмена', colorClass: 'bg-orange-500' },
  { value: 'none', label: 'Смена не назначена', colorClass: 'bg-white' },
];

const STATUS_SWATCH_CLASS: Record<ShiftStatus, string> = {
  worked: 'bg-emerald-500 border-emerald-600',
  'day-off': 'bg-blue-500 border-blue-600',
  sick: 'bg-violet-500 border-violet-600',
  'no-show': 'bg-rose-500 border-rose-600',
  vacation: 'bg-yellow-400 border-yellow-500',
  'planned-work': 'bg-orange-500 border-orange-600',
  none: 'bg-white border-stone-300',
};

const HOLIDAY_BY_MONTH_DAY: Record<string, string> = {
  '01-01': 'Новогодние каникулы',
  '01-02': 'Новогодние каникулы',
  '01-03': 'Новогодние каникулы',
  '01-04': 'Новогодние каникулы',
  '01-05': 'Новогодние каникулы',
  '01-06': 'Новогодние каникулы',
  '01-07': 'Рождество Христово',
  '01-08': 'Новогодние каникулы',
  '02-23': 'День защитника Отечества',
  '03-08': 'Международный женский день',
  '05-01': 'Праздник Весны и Труда',
  '05-09': 'День Победы',
  '06-12': 'День России',
  '11-04': 'День народного единства',
};

const isoDate = (year: number, month: number, day: number): string => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const normalizeDateKey = (value: string | null): string | null => {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

const isBeforeHiredAt = (employee: Employee, dayDate: string): boolean => {
  const hiredAt = normalizeDateKey(employee.hiredAt);
  if (!hiredAt) return false;
  return dayDate < hiredAt;
};

const getShiftStatus = (shifts: Shift[], employeeId: string, date: string): ShiftStatus => (
  shifts.find((shift) => shift.employeeId === employeeId && shift.date === date)?.status ?? 'none'
);

const splitIntoWeeks = <T,>(items: T[]): T[][] => {
  const weeks: T[][] = [];
  for (let index = 0; index < items.length; index += 7) {
    weeks.push(items.slice(index, index + 7));
  }
  return weeks;
};

const getHolidayName = (month: number, day: number): string | null => {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return HOLIDAY_BY_MONTH_DAY[key] ?? null;
};

export function CompactMonthlyGrid({
  employees,
  shifts,
  month,
  year,
  editable,
  onStatusChange,
}: CompactMonthlyGridProps) {
  const [activeEmployeeId, setActiveEmployeeId] = useState<ActiveEmployeeId>('all');
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  useEffect(() => {
    if (activeEmployeeId === 'all') return;
    if (!employees.some((employee) => employee.id === activeEmployeeId)) {
      setActiveEmployeeId('all');
    }
  }, [activeEmployeeId, employees]);

  const activeEmployee = activeEmployeeId === 'all'
    ? null
    : employees.find((employee) => employee.id === activeEmployeeId) ?? null;

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
        weekend: weekday === 0 || weekday === 6,
        isToday: date === todayKey,
        holidayName: getHolidayName(month, dayNumber),
      };
    });
  }, [month, year]);

  const weeks = useMemo(() => splitIntoWeeks(dayMeta), [dayMeta]);

  const unfilledDays = useMemo(() => dayMeta.filter((day) => {
    const eligibleEmployees = employees.filter((employee) => !isBeforeHiredAt(employee, day.date));
    if (eligibleEmployees.length === 0) return false;
    const eligibleEmployeeIds = new Set(eligibleEmployees.map((employee) => employee.id));

    const assignedCount = shifts.filter((shift) => (
      shift.date === day.date
      && eligibleEmployeeIds.has(shift.employeeId)
      && (shift.status === 'worked' || shift.status === 'planned-work')
    )).length;
    return assignedCount === 0;
  }), [dayMeta, employees, shifts]);

  const workedCountByEmployee = useMemo(() => {
    const dateKeys = new Set(dayMeta.map((day) => day.date));
    const counts = new Map<string, number>();

    for (const employee of employees) {
      counts.set(employee.id, 0);
    }

    for (const shift of shifts) {
      if (!dateKeys.has(shift.date) || shift.status !== 'worked') continue;
      counts.set(shift.employeeId, (counts.get(shift.employeeId) ?? 0) + 1);
    }

    return counts;
  }, [dayMeta, employees, shifts]);

  const applyStatus = (dayDate: string, status: ShiftStatus) => {
    if (!activeEmployee || !editable || !onStatusChange) return;
    if (isBeforeHiredAt(activeEmployee, dayDate)) return;
    onStatusChange(activeEmployee.id, dayDate, status);
    setOpenDayKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((status) => (
          <div key={status.value} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-stone-700">
            <span className={cn('h-3 w-3 rounded-full border border-stone-300', status.colorClass)} />
            <span>{status.label}</span>
          </div>
        ))}
      </div>

      {editable ? (
        <div className="rounded-xl border bg-white p-2">
          <div className="mb-2 text-xs font-medium text-stone-700">Активный сотрудник</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveEmployeeId('all');
                setOpenDayKey(null);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition',
                activeEmployeeId === 'all'
                  ? 'border-orange-300 bg-orange-50 text-orange-700'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
              )}
            >
              Все
            </button>
            {employees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => {
                  setActiveEmployeeId(employee.id);
                  setOpenDayKey(null);
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition',
                  activeEmployeeId === employee.id
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
                )}
              >
                {employee.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-3">
        <div className="mb-2 text-xs font-medium text-stone-700">Рабочих смен за месяц</div>
        <div className="flex flex-wrap gap-2">
          {employees.map((employee) => (
            <div
              key={`worked-count:${employee.id}`}
              className="inline-flex items-center gap-2 rounded-full border bg-stone-50 px-3 py-1 text-xs text-stone-700"
            >
              <span className="font-medium">{employee.name}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-stone-900">
                {workedCountByEmployee.get(employee.id) ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-stone-50/70 p-3 text-sm text-stone-700">
        <span className="font-medium">Незаполненные смены:</span>{' '}
        {unfilledDays.length === 0 ? 'нет' : unfilledDays.map((day) => day.dayNumber).join(', ')}
      </div>

      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
            {week.map((day) => {
              const canOpenDayEditor = editable && activeEmployeeId !== 'all' && !!activeEmployee && !isBeforeHiredAt(activeEmployee, day.date);

              return (
                <Popover
                  key={day.date}
                  open={openDayKey === day.date && canOpenDayEditor}
                  onOpenChange={(nextOpen) => setOpenDayKey(nextOpen ? day.date : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!canOpenDayEditor}
                      className={cn(
                        'rounded-xl border bg-white p-1.5 text-left transition',
                        canOpenDayEditor ? 'cursor-pointer hover:border-orange-300 hover:bg-orange-50/30' : 'cursor-default',
                        day.isToday ? 'ring-1 ring-orange-400' : '',
                        !canOpenDayEditor && editable ? 'disabled:opacity-95' : '',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-1.5 flex h-7 w-full items-center justify-center rounded-md text-xs font-semibold',
                          day.weekend || day.holidayName
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-stone-100 text-stone-700',
                        )}
                        title={day.holidayName ?? undefined}
                      >
                        {day.dayNumber}
                      </div>

                      <div className="space-y-1">
                        {employees.map((employee) => {
                          const status = getShiftStatus(shifts, employee.id, day.date);
                          const preHire = isBeforeHiredAt(employee, day.date);
                          const isActive = activeEmployeeId === employee.id;

                          return (
                            <div
                              key={`${day.date}:${employee.id}`}
                              className={cn(
                                'flex items-center justify-between rounded-md border px-2 py-1',
                                preHire ? 'border-dashed border-stone-200 bg-stone-50 text-stone-400' : 'border-stone-200 bg-white text-stone-700',
                                isActive ? 'ring-1 ring-orange-300 border-orange-200' : '',
                              )}
                            >
                              <span className="truncate text-[11px]">{employee.name}</span>
                              {preHire ? (
                                <span className="text-[10px] text-stone-400">ещё не работает</span>
                              ) : (
                                <span className={cn('h-3.5 w-3.5 rounded border', STATUS_SWATCH_CLASS[status])} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  </PopoverTrigger>

                  {day.holidayName ? (
                    <PopoverContent align="center" side="top" className="mb-1 w-auto max-w-[220px] p-2 text-xs">
                      {day.holidayName}
                    </PopoverContent>
                  ) : null}

                  {canOpenDayEditor ? (
                    <PopoverContent align="start" className="w-52 p-2">
                      <div className="mb-2 text-xs font-medium text-stone-800">
                        {activeEmployee?.name} • {day.dayNumber}.{String(month).padStart(2, '0')}.{year}
                      </div>
                      <div className="grid gap-1">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={`${day.date}:${option.value}`}
                            type="button"
                            onClick={() => applyStatus(day.date, option.value)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-stone-100"
                          >
                            <span className={cn('h-3.5 w-3.5 rounded-full border border-stone-300', option.colorClass)} />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  ) : null}
                </Popover>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
