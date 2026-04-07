import { useMemo } from 'react';
import type { Employee, Shift, ShiftStatus, ShiftStatusDb } from '../domain/types';
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
  workersCount: number;
  issue: boolean;
}

const OWNER_OPTIONS: Array<{ value: ShiftStatus; label: string }> = [
  { value: 'none', label: '—' },
  { value: 'planned-work', label: 'План' },
  { value: 'worked', label: 'Отраб.' },
  { value: 'day-off', label: 'Выходной' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick', label: 'Больничный' },
  { value: 'no-show', label: 'Не вышел' },
];

const STATUS_SHORT: Record<ShiftStatusDb, string> = {
  'planned-work': 'П',
  worked: 'О',
  'day-off': 'В',
  vacation: 'От',
  sick: 'Б',
  'no-show': 'Н',
};

const STATUS_CLASS: Record<ShiftStatusDb, string> = {
  'planned-work': 'bg-blue-50 text-blue-700 border-blue-200',
  worked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'day-off': 'bg-slate-100 text-slate-700 border-slate-200',
  vacation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sick: 'bg-amber-50 text-amber-700 border-amber-200',
  'no-show': 'bg-rose-50 text-rose-700 border-rose-200',
};

const getShiftStatus = (shifts: Shift[], employeeId: string, date: string): ShiftStatus => (
  shifts.find((shift) => shift.employeeId === employeeId && shift.date === date)?.status ?? 'none'
);

export function CompactMonthlyGrid({
  employees,
  shifts,
  month,
  year,
  editable,
  onStatusChange,
}: CompactMonthlyGridProps) {
  const dayMeta = useMemo<DayMeta[]>(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const weekday = new Date(year, month - 1, dayNumber).getDay();
      const workersCount = shifts.filter((shift) => (
        shift.date === date && (shift.status === 'planned-work' || shift.status === 'worked')
      )).length;

      return {
        date,
        dayNumber,
        weekend: weekday === 0 || weekday === 6,
        isToday: date === todayIso,
        workersCount,
        issue: workersCount !== 1,
      };
    });
  }, [month, shifts, year]);

  const problemDays = dayMeta.filter((day) => day.issue);

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Проблемные дни: {problemDays.length === 0 ? 'нет' : problemDays.map((day) => day.dayNumber).join(', ')}
      </div>

      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50">
              <th className="sticky left-0 z-20 min-w-[180px] border-b border-r bg-stone-50 px-3 py-2 text-left font-semibold">
                Сотрудник
              </th>
              {dayMeta.map((day) => (
                <th
                  key={day.date}
                  className={cn(
                    'min-w-[48px] border-b border-r px-1 py-2 text-center font-semibold',
                    day.weekend ? 'bg-stone-100' : 'bg-stone-50',
                    day.issue ? 'text-rose-700' : 'text-stone-700',
                    day.isToday ? 'ring-1 ring-orange-400 ring-inset' : '',
                  )}
                >
                  {day.dayNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="sticky left-0 z-10 border-b border-r bg-white px-3 py-2">
                  <div className="font-medium text-stone-900">{employee.name}</div>
                  <div className="text-[11px] text-muted-foreground">{employee.dailyRate} ₽/смена</div>
                </td>
                {dayMeta.map((day) => {
                  const status = getShiftStatus(shifts, employee.id, day.date);

                  return (
                    <td
                      key={`${employee.id}-${day.date}`}
                      className={cn(
                        'border-b border-r px-1 py-1 text-center',
                        day.weekend ? 'bg-stone-50/70' : 'bg-white',
                        day.isToday ? 'ring-1 ring-orange-300 ring-inset' : '',
                      )}
                    >
                      {editable ? (
                        <select
                          className={cn(
                            'h-7 w-full rounded border px-1 text-[11px] focus:outline-none',
                            status === 'none'
                              ? 'border-stone-200 bg-white text-stone-500'
                              : STATUS_CLASS[status as ShiftStatusDb],
                          )}
                          value={status}
                          onChange={(event) => onStatusChange?.(employee.id, day.date, event.target.value as ShiftStatus)}
                        >
                          {OWNER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : status === 'none' ? (
                        <span className="inline-block h-6 w-full rounded border border-dashed border-stone-200 bg-stone-50" />
                      ) : (
                        <span
                          className={cn(
                            'inline-flex h-6 w-full items-center justify-center rounded border text-[11px] font-medium',
                            STATUS_CLASS[status],
                          )}
                          title={status}
                        >
                          {STATUS_SHORT[status]}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

