import { useMemo } from 'react';
import { toast } from 'sonner';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { isShiftLikeStatus } from '../domain/shiftStatus';
import type { Employee, EmployeeStats, Payment, Shift } from '../domain/types';
import { getLocalISODate } from '../lib/date';
import { getMonthStatusLabels, getDashboardCopy } from './dashboardCopy';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

const getMonthYear = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
};

const isInMonth = (date: string, month: number, year: number) => {
  const parsed = getMonthYear(date);
  return parsed.month === month && parsed.year === year;
};

const resolveShiftStatus = (shift: Shift) => (
  shift.actualStatus ?? shift.approvedStatus ?? shift.requestedStatus ?? shift.status
);

export default function DashboardPage() {
  const { language, locale, t } = useLanguage();
  const copy = getDashboardCopy(language);
  const monthStatusLabels = getMonthStatusLabels(language);

  const {
    employees,
    shifts,
    payments,
    selectedMonth,
    selectedYear,
    selectedMonthStatus,
    setSelectedMonth,
    setSelectedYear,
    getEmployeeStats,
    getEmployeeLifetimeStats,
    exportEmployeePayslipXlsx,
    isOwner,
    myEmployeeId,
  } = useApp();

  const activeEmployees = useMemo(() => employees.filter((employee) => !employee.archived), [employees]);
  const myEmployee = useMemo(
    () => (myEmployeeId ? employees.find((employee) => employee.id === myEmployeeId) ?? null : null),
    [employees, myEmployeeId],
  );

  const monthStats = useMemo(() => {
    let workedCount = 0;
    let workedTotal = 0;
    let earnedActual = 0;
    let paidApproved = 0;
    let dueNow = 0;

    for (const employee of activeEmployees) {
      const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
      const lifetimeStats = getEmployeeLifetimeStats(employee.id);
      workedCount += stats.workedCount;
      workedTotal += lifetimeStats.workedCount;
      earnedActual += stats.earnedActual;
      paidApproved += stats.paidApproved;
      dueNow += stats.dueNow;
    }

    return {
      workedCount,
      workedTotal,
      earnedActual,
      paidApproved,
      dueNow,
    };
  }, [activeEmployees, getEmployeeLifetimeStats, getEmployeeStats, selectedMonth, selectedYear]);

  const myLifetimeStats = useMemo(
    () => (myEmployee ? getEmployeeLifetimeStats(myEmployee.id) : null),
    [getEmployeeLifetimeStats, myEmployee],
  );

  const pendingPaymentsCount = useMemo(() => (
    payments.filter((payment) => (
      payment.status === 'pending' && isInMonth(payment.date, selectedMonth, selectedYear)
    )).length
  ), [payments, selectedMonth, selectedYear]);

  const todayInfo = useMemo(() => {
    const today = getLocalISODate();
    const todayShifts = shifts.filter((shift) => shift.date === today);

    const planned = todayShifts.filter((shift) => isShiftLikeStatus(resolveShiftStatus(shift)));
    const sick = todayShifts.filter((shift) => resolveShiftStatus(shift) === 'sick_leave');
    const dayOff = todayShifts.filter((shift) => {
      const status = resolveShiftStatus(shift);
      return status === 'day_off' || status === 'no_shift';
    });

    return {
      planned: planned.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? copy.common.emptyEmployeeName),
      sick: sick.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? copy.common.emptyEmployeeName),
      dayOff: dayOff.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? copy.common.emptyEmployeeName),
      issue: planned.length === 0,
    };
  }, [copy.common.emptyEmployeeName, employees, shifts]);

  const handleExport = async (employeeId: string) => {
    const result = await exportEmployeePayslipXlsx(employeeId, selectedMonth, selectedYear);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(copy.messages.payslipExported);
  };

  return (
    <div className="bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {t('Месяц', 'Month')}: {monthStatusLabels[selectedMonthStatus]}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <MonthYearSelector
                month={selectedMonth}
                year={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
              />

              {!isOwner && myEmployee ? (
                <Button onClick={() => void handleExport(myEmployee.id)}>{copy.common.myPayslip}</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {isOwner ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label={copy.admin.stats.workedDays}
                value={String(monthStats.workedCount)}
                detail={String(monthStats.workedTotal)}
                helper={copy.admin.stats.workedDaysHint}
              />
              <StatCard label={copy.admin.stats.earnedActual} value={money(monthStats.earnedActual, locale)} />
              <StatCard label={copy.admin.stats.paidApproved} value={money(monthStats.paidApproved, locale)} />
              <StatCard label={copy.admin.stats.dueNow} value={money(monthStats.dueNow, locale)} />
              <StatCard label={copy.admin.stats.pendingPayments} value={String(pendingPaymentsCount)} />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>{copy.admin.today.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <InfoLine label={copy.admin.today.planned} value={todayInfo.planned.join(', ') || copy.admin.today.nobody} />
                <InfoLine label={copy.admin.today.sick} value={todayInfo.sick.join(', ') || copy.admin.today.none} />
                <InfoLine label={copy.admin.today.dayOff} value={todayInfo.dayOff.join(', ') || copy.admin.today.none} />
                <InfoLine label={copy.admin.today.coverage} value={todayInfo.issue ? copy.admin.today.issue : copy.admin.today.closed} />
              </CardContent>
            </Card>
          </>
        ) : (
          <EmployeeDashboard
            employee={myEmployee}
            stats={myEmployee ? getEmployeeStats(myEmployee.id, selectedMonth, selectedYear) : null}
            lifetimeStats={myLifetimeStats}
            payments={myEmployee ? payments.filter((payment) => payment.employeeId === myEmployee.id) : []}
            copy={copy}
            locale={locale}
            onExport={() => {
              if (myEmployee) {
                void handleExport(myEmployee.id);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  helper,
}: {
  label: string;
  value: string;
  detail?: string;
  helper?: string;
}) {
  return (
    <Card className="border-stone-200/80 shadow-sm shadow-stone-100/60">
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-end gap-2">
          <div className="text-2xl font-semibold leading-none tabular-nums">{value}</div>
          {detail ? (
            <div className="flex items-center gap-2 pb-0.5 text-sm text-stone-400">
              <span>/</span>
              <span className="font-medium text-stone-500 tabular-nums">{detail}</span>
            </div>
          ) : null}
        </div>
        {helper ? (
          <div className="mt-2 text-xs text-stone-500">{helper}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 font-medium text-stone-900">{value}</div>
    </div>
  );
}

function EmployeeDashboard({
  employee,
  stats,
  lifetimeStats,
  payments,
  copy,
  locale,
  onExport,
}: {
  employee: Employee | null;
  stats: EmployeeStats | null;
  lifetimeStats: EmployeeStats | null;
  payments: Payment[];
  copy: ReturnType<typeof getDashboardCopy>;
  locale: string;
  onExport: () => void;
}) {
  if (!employee || !stats || !lifetimeStats) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          {copy.employee.unlinked}
        </CardContent>
      </Card>
    );
  }

  const pendingCount = payments.filter((payment) => payment.status === 'pending').length;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={copy.employee.stats.workedCount}
          value={String(stats.workedCount)}
          detail={String(lifetimeStats.workedCount)}
          helper={copy.employee.stats.workedCountHint}
        />
        <StatCard label={copy.employee.stats.earnedActual} value={money(stats.earnedActual, locale)} />
        <StatCard label={copy.employee.stats.paidApproved} value={money(stats.paidApproved, locale)} />
        <StatCard label={copy.employee.stats.dueNow} value={money(stats.dueNow, locale)} />
        <StatCard label={copy.employee.stats.forecastTotal} value={money(stats.forecastTotal, locale)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard label={copy.employee.stats.sickCount} value={String(stats.sickCount)} />
        <StatCard label={copy.employee.stats.dayOffCount} value={String(stats.dayOffCount)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{copy.employee.exportTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-sm text-muted-foreground">
            {copy.employee.pendingPayments(pendingCount)}
          </div>
          <Button onClick={onExport}>{copy.employee.downloadPayslip}</Button>
        </CardContent>
      </Card>
    </>
  );
}
