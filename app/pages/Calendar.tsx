import { useMemo } from 'react';
import { toast } from 'sonner';
import { CompactMonthlyGrid } from '../components/CompactMonthlyGrid';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import type { MonthStatus } from '../domain/types';
import { getMonthStatusLabels } from './dashboardCopy';

const MONTH_STATUS_META: Record<MonthStatus, { className: string }> = {
  draft: {
    className: 'bg-slate-100 text-slate-700',
  },
  pending_approval: {
    className: 'bg-amber-100 text-amber-800',
  },
  approved: {
    className: 'bg-emerald-100 text-emerald-800',
  },
  closed: {
    className: 'bg-stone-200 text-stone-800',
  },
};

export default function CalendarPage() {
  const { language, t } = useLanguage();
  const monthStatusLabels = getMonthStatusLabels(language);
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

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !employee.archived),
    [employees],
  );

  const editableEmployeeIds = useMemo(() => {
    if (!canEditSelectedMonth) {
      return [];
    }

    if (isOwner) {
      return activeEmployees.map((employee) => employee.id);
    }

    return myEmployeeId ? [myEmployeeId] : [];
  }, [activeEmployees, canEditSelectedMonth, isOwner, myEmployeeId]);

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

    toast.success(t('Статус месяца обновлён.', 'Month status updated.'));
  };

  const monthMeta = MONTH_STATUS_META[selectedMonthStatus];

  return (
    <div className="bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${monthMeta.className}`}>
                {t('Месяц', 'Month')}: {monthStatusLabels[selectedMonthStatus]}
              </div>
              <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {isOwner
                  ? `${activeEmployees.length} ${t('сотрудников в графике', 'employees in the schedule')}`
                  : t('Общий график команды', 'Shared team schedule')}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                      {t('На утверждение', 'Send for approval')}
                    </Button>
                  ) : null}
                  {(selectedMonthStatus === 'draft' || selectedMonthStatus === 'pending_approval') ? (
                    <Button onClick={() => void handleMonthStatusChange('approved')}>
                      {t('Утвердить месяц', 'Approve month')}
                    </Button>
                  ) : null}
                  {selectedMonthStatus === 'approved' ? (
                    <Button variant="outline" onClick={() => void handleMonthStatusChange('closed')}>
                      {t('Закрыть месяц', 'Close month')}
                    </Button>
                  ) : null}
                  {selectedMonthStatus === 'pending_approval' ? (
                    <Button variant="outline" onClick={() => void handleMonthStatusChange('draft')}>
                      {t('Вернуть в черновик', 'Return to draft')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            {activeEmployees.length > 0 ? (
              <CompactMonthlyGrid
                employees={activeEmployees}
                shifts={shifts}
                month={selectedMonth}
                year={selectedYear}
                editable={canEditSelectedMonth}
                editableEmployeeIds={editableEmployeeIds}
                onStatusChange={(employeeId, date, status) => void handleStatusChange(employeeId, date, status)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                {t('В этой организации пока нет активных сотрудников.', 'There are no active employees in this organization yet.')}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
