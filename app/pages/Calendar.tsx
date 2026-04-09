import { useMemo } from 'react';
import { toast } from 'sonner';
import { BottomNav } from '../components/BottomNav';
import { CompactMonthlyGrid } from '../components/CompactMonthlyGrid';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useApp } from '../context/AppContext';
import type { MonthStatus } from '../domain/types';

const MONTH_STATUS_META: Record<MonthStatus, { label: string; className: string }> = {
  draft: {
    label: 'Черновик',
    className: 'bg-slate-100 text-slate-700',
  },
  pending_approval: {
    label: 'На утверждении',
    className: 'bg-amber-100 text-amber-800',
  },
  approved: {
    label: 'Утвержден',
    className: 'bg-emerald-100 text-emerald-800',
  },
  closed: {
    label: 'Закрыт',
    className: 'bg-stone-200 text-stone-800',
  },
};

export default function CalendarPage() {
  const {
    employees,
    shifts,
    selectedMonth,
    selectedYear,
    selectedMonthStatus,
    canEditSelectedMonth,
    setSelectedMonth,
    setSelectedYear,
    setSelectedMonthStatus,
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

  const handleMonthStatusChange = async (nextStatus: MonthStatus) => {
    const result = await setSelectedMonthStatus(nextStatus);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Статус месяца обновлен.');
  };

  const monthMeta = MONTH_STATUS_META[selectedMonthStatus];

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  Календарь
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${monthMeta.className}`}>
                  {monthMeta.label}
                </div>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                {isOwner ? 'График смен команды' : 'Мои пожелания по графику'}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                {isOwner
                  ? 'Здесь администратор утверждает смены, следит за покрытием дней и закрывает месяц.'
                  : 'Здесь ты указываешь только свои пожелания по дням. После утверждения месяц редактировать нельзя.'}
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <MonthYearSelector
                month={selectedMonth}
                year={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
              />

              {isOwner ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMonthStatus === 'draft' ? (
                    <Button variant="outline" onClick={() => void handleMonthStatusChange('pending_approval')}>
                      На утверждение
                    </Button>
                  ) : null}
                  {(selectedMonthStatus === 'draft' || selectedMonthStatus === 'pending_approval') ? (
                    <Button onClick={() => void handleMonthStatusChange('approved')}>
                      Утвердить месяц
                    </Button>
                  ) : null}
                  {selectedMonthStatus === 'approved' ? (
                    <Button variant="outline" onClick={() => void handleMonthStatusChange('closed')}>
                      Закрыть месяц
                    </Button>
                  ) : null}
                  {selectedMonthStatus === 'pending_approval' ? (
                    <Button variant="outline" onClick={() => void handleMonthStatusChange('draft')}>
                      Вернуть в черновик
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
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
                editable={canEditSelectedMonth}
                onStatusChange={(employeeId, date, status) => void handleStatusChange(employeeId, date, status)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Для этого аккаунта пока нет доступного сотрудника.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
