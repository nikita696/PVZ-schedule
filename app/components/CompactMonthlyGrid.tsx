import { useMemo, useState } from 'react';
import type { Employee, Shift, ShiftStatus, ShiftStatusDb } from '../domain/types';
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

const STATUS_CELL_CLASS: Record<ShiftStatus, string> = {
  worked: 'bg-emerald-500 border-emerald-600',
  'day-off': 'bg-blue-500 border-blue-600',
  sick: 'bg-violet-500 border-violet-600',
  'no-show': 'bg-rose-500 border-rose-600',
  vacation: 'bg-yellow-400 border-yellow-500',
  'planned-work': 'bg-orange-500 border-orange-600',
  none: 'bg-white border-stone-200',
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

const getShiftStatus = (shifts: Shift[], employeeId: string, date: string): ShiftStatus => (
  shifts.find((shift) => shift.employeeId === employeeId && shift.date === date)?.status ?? 'none'
);

const getHolidayName = (month: number, day: number): string | null => {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return HOLIDAY_BY_MONTH_DAY[key] ?? null;
};

const splitIntoWeeks = <T,>(items: T[]): T[][] => {
  const weeks: T[][] = [];
  for (let i = 0; i < items.length; i += 7) {
    weeks.push(items.slice(i, i + 7));
  }
  return weeks;
};

export function CompactMonthlyGrid({
  employees,
  shifts,
  month,
  year,
  editable,
  onStatusChange,
}: CompactMonthlyGridProps) {
  const [openCellKey, setOpenCellKey] = useState<string | null>(null);

  const dayMeta = useMemo<DayMeta[]>(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const weekday = new Date(year, month - 1, dayNumber).getDay();
      const holidayName = getHolidayName(month, dayNumber);

      return {
        date,
        dayNumber,
        weekend: weekday === 0 || weekday === 6,
        isToday: date === todayIso,
        holidayName,
      };
    });
  }, [month, year]);

  const weeks = useMemo(() => splitIntoWeeks(dayMeta), [dayMeta]);

  const unfilledDays = useMemo(() => dayMeta.filter((day) => {
    const assignedCount = shifts.filter((shift) => (
      shift.date === day.date && (shift.status === 'worked' || shift.status === 'planned-work')
    )).length;
    return assignedCount === 0;
  }), [dayMeta, shifts]);

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

      <div className="rounded-xl border bg-stone-50/70 p-3 text-sm text-stone-700">
        <span className="font-medium">Незаполненные смены:</span>{' '}
        {unfilledDays.length === 0 ? 'нет' : unfilledDays.map((day) => day.dayNumber).join(', ')}
      </div>

      {editable ? (
        <div className="rounded-xl border bg-white p-3 text-xs text-stone-600">
          <div className="font-medium text-stone-800">Порядок сотрудников в ячейке дня</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {employees.map((employee, index) => (
              <div key={employee.id} className="inline-flex items-center gap-2 rounded-full border bg-stone-50 px-2.5 py-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700">
                  {index + 1}
                </span>
                <span>{employee.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={`${year}-${month}-week-${weekIndex}`} className="grid grid-cols-7 gap-2">
            {week.map((day) => (
              <div
                key={day.date}
                className={cn(
                  'rounded-xl border bg-white p-1.5',
                  day.isToday ? 'ring-1 ring-orange-400' : '',
                )}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title={day.holidayName ?? undefined}
                      className={cn(
                        'mb-1.5 flex h-7 w-full items-center justify-center rounded-md text-xs font-semibold',
                        day.weekend || day.holidayName
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-stone-100 text-stone-700',
                      )}
                    >
                      {day.dayNumber}
                    </button>
                  </PopoverTrigger>
                  {day.holidayName ? (
                    <PopoverContent className="w-auto max-w-[220px] p-2 text-xs">
                      {day.holidayName}
                    </PopoverContent>
                  ) : null}
                </Popover>

                <div className="grid gap-1">
                  {employees.map((employee) => {
                    const status = getShiftStatus(shifts, employee.id, day.date);
                    const cellKey = `${employee.id}:${day.date}`;

                    if (!editable) {
                      return (
                        <div
                          key={cellKey}
                          className={cn(
                            'h-7 w-full rounded-md border',
                            STATUS_CELL_CLASS[status],
                          )}
                          title={`${employee.name}: ${status}`}
                        />
                      );
                    }

                    return (
                      <Popover
                        key={cellKey}
                        open={openCellKey === cellKey}
                        onOpenChange={(nextOpen) => setOpenCellKey(nextOpen ? cellKey : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Изменить смену: ${employee.name}, ${day.date}`}
                            className={cn(
                              'h-8 w-full rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
                              STATUS_CELL_CLASS[status],
                            )}
                          />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-52 p-2">
                          <div className="mb-2 text-xs font-medium text-stone-800">{employee.name}</div>
                          <div className="grid gap-1">
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={`${cellKey}:${option.value}`}
                                type="button"
                                onClick={() => {
                                  onStatusChange?.(employee.id, day.date, option.value);
                                  setOpenCellKey(null);
                                }}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-stone-100"
                              >
                                <span className={cn('h-3.5 w-3.5 rounded-full border border-stone-300', option.colorClass)} />
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

