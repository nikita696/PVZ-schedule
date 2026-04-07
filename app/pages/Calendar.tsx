import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { BottomNav } from '../components/BottomNav';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { ShiftStatusSelector } from '../components/ShiftStatusSelector';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useApp } from '../context/AppContext';

const STATUS_LABELS = {
  working: 'Работает',
  'day-off': 'Выходной',
  sick: 'Больничный',
  'no-show': 'Не вышел',
  none: 'Не выбрано',
};

export default function CalendarPage() {
  const {
    employees,
    shifts,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateShift,
  } = useApp();

  const activeEmployees = employees.filter((employee) => !employee.archived);

  const days = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const isoDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = shifts.filter((shift) => shift.date === isoDate);
      const workers = dayShifts.filter((shift) => shift.status === 'working').length;
      const issue = workers !== 1;

      return {
        isoDate,
        label: new Date(selectedYear, selectedMonth - 1, day).toLocaleDateString('ru-RU', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        issue,
      };
    });
  }, [selectedMonth, selectedYear, shifts]);

  const getStatus = (employeeId: string, date: string) => (
    shifts.find((shift) => shift.employeeId === employeeId && shift.date === date)?.status ?? 'none'
  );

  const handleStatusChange = async (
    employeeId: string,
    date: string,
    nextStatus: 'working' | 'day-off' | 'sick' | 'no-show' | 'none',
  ) => {
    const result = await updateShift(employeeId, date, nextStatus);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="w-fit rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-700">
                Календарь смен
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                Распределение смен по дням
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                В идеале на каждый день должен быть ровно один сотрудник со статусом «Работа».
                Календарь подсвечивает дни без назначенного сотрудника или с несколькими выходами.
              </p>
            </div>

            <MonthYearSelector
              month={selectedMonth}
              year={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Легенда</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-full border px-3 py-1.5">
                {label}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {days.map((day) => (
            <Card key={day.isoDate} className={day.issue ? 'border-amber-300' : ''}>
              <CardContent className="grid gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-stone-900">{day.label}</div>
                    {day.issue ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Проблема в назначении
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                        Закрыто
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  {activeEmployees.map((employee) => (
                    <div key={`${employee.id}-${day.isoDate}`} className="rounded-2xl border p-4">
                      <div className="mb-3 text-sm font-semibold text-stone-900">{employee.name}</div>
                      <ShiftStatusSelector
                        value={getStatus(employee.id, day.isoDate)}
                        onChange={(status) => void handleStatusChange(employee.id, day.isoDate, status)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {activeEmployees.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Сначала добавьте сотрудников на главной странице, затем заполняйте календарь.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
