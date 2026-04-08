import { useMemo } from 'react';
import { toast } from 'sonner';
import { BottomNav } from '../components/BottomNav';
import { CompactMonthlyGrid } from '../components/CompactMonthlyGrid';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { Card, CardContent } from '../components/ui/card';
import { useApp } from '../context/AppContext';

export default function CalendarPage() {
  const {
    employees,
    shifts,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    updateShift,
    isOwner,
    myEmployeeId,
  } = useApp();

  const visibleEmployees = useMemo(() => {
    const activeEmployees = employees.filter((employee) => !employee.archived);
    if (isOwner) return activeEmployees;
    return activeEmployees.filter((employee) => employee.id === myEmployeeId);
  }, [employees, isOwner, myEmployeeId]);

  const handleStatusChange = async (employeeId: string, date: string, status: Parameters<typeof updateShift>[2]) => {
    const result = await updateShift(employeeId, date, status);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                Календарь смен
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                {isOwner ? 'Расписание ПВЗ по неделям' : 'Мой календарь смен'}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                {isOwner
                  ? 'Сетка по 7 дней в строке. В ячейках смен только цвет, выбор статуса — через popover.'
                  : 'Режим чтения: только ваши смены, без редактирования.'}
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
          <CardContent className="p-4 sm:p-5">
            {visibleEmployees.length > 0 ? (
              <CompactMonthlyGrid
                employees={visibleEmployees}
                shifts={shifts}
                month={selectedMonth}
                year={selectedYear}
                editable={isOwner}
                onStatusChange={isOwner ? (employeeId, date, status) => void handleStatusChange(employeeId, date, status) : undefined}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Нет сотрудников для отображения.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}

