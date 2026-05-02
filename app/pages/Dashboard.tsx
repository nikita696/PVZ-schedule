import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { cn } from '../components/ui/utils';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { buildDashboardPayrollSummary, type DashboardPayrollEmployeeRow } from '../domain/dashboardPayroll';
import { isShiftLikeStatus } from '../domain/shiftStatus';
import type { AddPaymentInput, Employee, EmployeeDebtSnapshot, EmployeeStats, Payment, Shift } from '../domain/types';
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

const formatMonthLabel = (month: number, year: number, locale: string): string => {
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const sortPaymentsDesc = (payments: Payment[]): Payment[] => (
  [...payments].sort((left, right) => {
    if (left.date !== right.date) return right.date.localeCompare(left.date);
    return right.createdAt.localeCompare(left.createdAt);
  })
);

interface PaymentDraft {
  employeeId: string;
  amount: number;
  comment: string;
}

export default function DashboardPage() {
  const { language, locale, t } = useLanguage();
  const copy = getDashboardCopy(language);
  const monthStatusLabels = getMonthStatusLabels(language);

  const {
    employees,
    rateHistory,
    shifts,
    payments,
    currentUserSummary,
    selectedMonth,
    selectedYear,
    selectedMonthStatus,
    setSelectedMonth,
    setSelectedYear,
    addPayment,
    getEmployeeStats,
    getEmployeeDebtSnapshot,
    exportEmployeePayslipXlsx,
    isOwner,
    myEmployeeId,
  } = useApp();
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);

  const monthLabel = useMemo(
    () => formatMonthLabel(selectedMonth, selectedYear, locale),
    [locale, selectedMonth, selectedYear],
  );

  const myEmployee = useMemo(
    () => {
      if (myEmployeeId) {
        return employees.find((employee) => employee.id === myEmployeeId) ?? null;
      }

      const normalizedEmail = currentUserSummary?.email?.trim().toLowerCase() ?? null;

      return employees.find((employee) => {
        if (employee.archived) {
          return false;
        }

        if (currentUserSummary?.authUserId && employee.authUserId === currentUserSummary.authUserId) {
          return true;
        }

        if (normalizedEmail && employee.workEmail?.trim().toLowerCase() === normalizedEmail) {
          return true;
        }

        return isOwner && employee.isOwner;
      }) ?? null;
    },
    [currentUserSummary?.authUserId, currentUserSummary?.email, employees, isOwner, myEmployeeId],
  );

  const payrollSummary = useMemo(() => buildDashboardPayrollSummary({
    employees,
    rateHistory,
    shifts,
    payments,
  }, selectedMonth, selectedYear), [
    employees,
    payments,
    rateHistory,
    selectedMonth,
    selectedYear,
    shifts,
  ]);

  const monthWorkdayTotal = useMemo(() => {
    const scheduledDays = new Set<string>();

    for (const shift of shifts) {
      if (!isInMonth(shift.date, selectedMonth, selectedYear)) {
        continue;
      }

      if (!isShiftLikeStatus(resolveShiftStatus(shift))) {
        continue;
      }

      scheduledDays.add(shift.date);
    }

    return scheduledDays.size;
  }, [selectedMonth, selectedYear, shifts]);

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

  const handleAddPayment = async (input: AddPaymentInput) => {
    const result = await addPayment(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setPaymentDraft(null);
    toast.success(result.message ?? t('Выплата сохранена.', 'Payment saved.'));
  };

  const handleOpenBalancePayment = (row: DashboardPayrollEmployeeRow) => {
    setPaymentDraft({
      employeeId: row.employee.id,
      amount: row.outstandingDue,
      comment: t(`Выплата зарплаты за ${monthLabel}`, `Payroll payment for ${monthLabel}`),
    });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <DashboardToolbar
          month={selectedMonth}
          year={selectedYear}
          statusLabel={monthStatusLabels[selectedMonthStatus]}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
        />

        {isOwner ? (
          <>
            <AdminPayrollDashboard
              summary={payrollSummary}
              monthLabel={monthLabel}
              statusLabel={monthStatusLabels[selectedMonthStatus]}
              locale={locale}
              onPayBalance={handleOpenBalancePayment}
            />

            <TodayStrip todayInfo={todayInfo} />

            <AddPaymentModal
              open={paymentDraft !== null}
              employees={employees}
              fixedEmployeeId={paymentDraft?.employeeId ?? null}
              initialAmount={paymentDraft?.amount ?? null}
              initialComment={paymentDraft?.comment ?? ''}
              onClose={() => setPaymentDraft(null)}
              onSubmit={handleAddPayment}
            />
          </>
        ) : (
          <EmployeeDashboard
            employee={myEmployee}
            stats={myEmployee ? getEmployeeStats(myEmployee.id, selectedMonth, selectedYear) : null}
            debtSnapshot={myEmployee ? getEmployeeDebtSnapshot(myEmployee.id) : null}
            monthWorkdayTotal={monthWorkdayTotal}
            payments={myEmployee ? payments.filter((payment) => payment.employeeId === myEmployee.id) : []}
            month={selectedMonth}
            year={selectedYear}
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

function DashboardToolbar({
  month,
  year,
  statusLabel,
  onMonthChange,
  onYearChange,
}: {
  month: number;
  year: number;
  statusLabel: string;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  const { t } = useLanguage();

  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
            {t('Зарплатная сводка', 'Payroll overview')}
          </span>
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
            {t('Месяц', 'Month')}: {statusLabel}
          </span>
        </div>

        <MonthYearSelector
          month={month}
          year={year}
          onMonthChange={onMonthChange}
          onYearChange={onYearChange}
        />
      </CardContent>
    </Card>
  );
}

function AdminPayrollDashboard({
  summary,
  monthLabel,
  statusLabel,
  locale,
  onPayBalance,
}: {
  summary: ReturnType<typeof buildDashboardPayrollSummary>;
  monthLabel: string;
  statusLabel: string;
  locale: string;
  onPayBalance: (row: DashboardPayrollEmployeeRow) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4" data-testid="owner-payroll-dashboard">
      <Card className="rounded-lg" data-testid="payroll-calculator">
        <CardContent className="p-4 lg:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {monthLabel}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {statusLabel}
              </span>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                {t('Осталось выплатить за месяц', 'Remaining payroll for the month')}
              </div>
              <div className="mt-2 text-4xl font-semibold leading-none text-stone-950 tabular-nums sm:text-5xl">
                {money(summary.totals.outstandingDue, locale)}
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
                {t(
                  `Расчет: начислено ${money(summary.totals.earnedActual, locale)} - подтвержденные выплаты ${money(summary.totals.paidApproved, locale)} = остаток ${money(summary.totals.outstandingDue, locale)}. Заявки на выплату не уменьшают долг, пока они не подтверждены.`,
                  `Calculation: accrued ${money(summary.totals.earnedActual, locale)} - approved payments ${money(summary.totals.paidApproved, locale)} = remaining ${money(summary.totals.outstandingDue, locale)}. Payment requests do not reduce the balance until approved.`,
                )}
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <CompactFact
                label={t('Уже выплачено', 'Already paid')}
                value={money(summary.totals.paidApproved, locale)}
              />
              <CompactFact
                label={t('Заявки ждут', 'Requests pending')}
                value={`${summary.pendingPayments.count} / ${money(summary.pendingPayments.amount, locale)}`}
              />
              <CompactFact
                label={t('Резерв до конца месяца', 'Reserve to month end')}
                value={money(summary.totals.reserveToMonthEnd, locale)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {t('Расчет по сотрудникам', 'Employee payroll')}
              </CardTitle>
              <p className="mt-1 text-sm text-stone-500">
                {t('Каждая строка показывает начисление, выплаты и остаток за выбранный месяц.', 'Each row shows accrued pay, approved payments, and remaining balance for the selected month.')}
              </p>
            </div>
            <div className="text-xs text-stone-500">
              {t('Формула', 'Formula')}: {t('начислено - выплачено = остаток', 'accrued - paid = balance')}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[900px] table-fixed">
            <TableHeader>
              <TableRow className="bg-stone-50/80">
                <TableHead className="w-[190px] px-4 py-2">{t('Сотрудник', 'Employee')}</TableHead>
                <TableHead className="w-[92px] px-4 py-2 text-center">{t('Смены', 'Shifts')}</TableHead>
                <TableHead className="w-[118px] px-4 py-2 text-right">{t('Ставка', 'Rate')}</TableHead>
                <TableHead className="w-[130px] px-4 py-2 text-right">{t('Начислено', 'Accrued')}</TableHead>
                <TableHead className="w-[130px] px-4 py-2 text-right">{t('Выплачено', 'Paid')}</TableHead>
                <TableHead className="w-[130px] px-4 py-2 text-right">{t('Остаток', 'Balance')}</TableHead>
                <TableHead className="w-[130px] px-4 py-2 text-right">{t('Прогноз', 'Forecast')}</TableHead>
                <TableHead className="w-[150px] px-4 py-2 text-right">{t('Действие', 'Action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={row.employee.id} data-testid="payroll-employee-row" data-employee-id={row.employee.id}>
                  <TableCell className="px-4 py-3">
                    <div className="font-medium text-stone-950">{row.employee.name}</div>
                    <div className="mt-0.5 truncate text-xs text-stone-500">{row.employee.workEmail ?? '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center font-medium tabular-nums">
                    {row.stats.workedCount}
                    {row.stats.plannedCount > 0 ? (
                      <span className="text-stone-400"> +{row.stats.plannedCount}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{money(row.employee.dailyRate, locale)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{money(row.stats.earnedActual, locale)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{money(row.stats.paidApproved, locale)}</TableCell>
                  <TableCell className={cn(
                    'px-4 py-3 text-right font-semibold tabular-nums',
                    row.stats.dueNow > 0 ? 'text-rose-700' : 'text-stone-950',
                  )}>
                    {money(row.stats.dueNow, locale)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{money(row.stats.forecastTotal, locale)}</TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    {row.outstandingDue > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => onPayBalance(row)}
                        data-testid={`payroll-pay-balance-${row.employee.id}`}
                      >
                        <WalletCards className="h-3.5 w-3.5" />
                        {t('Выплатить', 'Pay')}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('Выплачено', 'Paid')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <BudgetFact
            label={t('Уже заработано', 'Earned so far')}
            value={money(summary.totals.earnedActual, locale)}
            helper={t('Только фактически отработанные смены.', 'Worked shifts only.')}
          />
          <BudgetFact
            label={t('Будущие смены', 'Future shifts')}
            value={money(summary.totals.plannedFutureAmount, locale)}
            helper={t('Запланированные смены до конца выбранного месяца.', 'Planned shifts through the selected month.')}
          />
          <BudgetFact
            label={t('Фонд месяца', 'Month payroll fund')}
            value={money(summary.totals.forecastTotal, locale)}
            helper={t('Начислено сейчас + будущие смены.', 'Current accrued pay plus future shifts.')}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CompactFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-stone-950 tabular-nums">{value}</div>
    </div>
  );
}

function BudgetFact({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-stone-950 tabular-nums">{value}</div>
      <div className="mt-1 text-xs leading-5 text-stone-500">{helper}</div>
    </div>
  );
}

function TodayStrip({
  todayInfo,
}: {
  todayInfo: {
    planned: string[];
    sick: string[];
    dayOff: string[];
    issue: boolean;
  };
}) {
  const { t } = useLanguage();

  return (
    <Card className="rounded-lg">
      <CardContent className="grid gap-3 p-4 text-sm md:grid-cols-[auto_1fr_1fr_1fr] md:items-center">
        <div className="flex items-center gap-2 font-semibold text-stone-950">
          {todayInfo.issue ? (
            <AlertCircle className="h-4 w-4 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          {t('Сегодня', 'Today')}
        </div>
        <InlineInfo label={t('На смене', 'On shift')} value={todayInfo.planned.join(', ') || t('никого', 'nobody')} />
        <InlineInfo label={t('Больничный', 'Sick leave')} value={todayInfo.sick.join(', ') || t('нет', 'none')} />
        <InlineInfo
          label={t('Покрытие', 'Coverage')}
          value={todayInfo.issue ? t('нет назначенной смены', 'no assigned shift') : t('смена назначена', 'shift assigned')}
        />
      </CardContent>
    </Card>
  );
}

function InlineInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-xs font-medium text-stone-500">{label}: </span>
      <span className="font-medium text-stone-900">{value}</span>
    </div>
  );
}

function EmployeeDashboard({
  employee,
  stats,
  debtSnapshot,
  monthWorkdayTotal,
  payments,
  month,
  year,
  copy,
  locale,
  onExport,
}: {
  employee: Employee | null;
  stats: EmployeeStats | null;
  debtSnapshot: EmployeeDebtSnapshot | null;
  monthWorkdayTotal: number;
  payments: Payment[];
  month: number;
  year: number;
  copy: ReturnType<typeof getDashboardCopy>;
  locale: string;
  onExport: () => void;
}) {
  const { t } = useLanguage();

  if (!employee || !stats || !debtSnapshot) {
    return (
      <Card className="rounded-lg">
        <CardContent className="p-5 text-sm text-muted-foreground">
          {copy.employee.unlinked}
        </CardContent>
      </Card>
    );
  }

  const monthPayments = sortPaymentsDesc(payments.filter((payment) => isInMonth(payment.date, month, year)));
  const recentPayments = monthPayments.slice(0, 4);
  const pendingCount = monthPayments.filter((payment) => payment.status === 'pending').length;
  const plannedFutureAmount = Math.max(0, stats.forecastTotal - stats.earnedActual);

  return (
    <div className="grid gap-4" data-testid="employee-payroll-dashboard">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
                {t('Мой расчет', 'My payroll')}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {employee.name}
              </span>
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              {t('Баланс на сегодня', 'Balance to date')}
            </div>
            <div className="mt-2 text-4xl font-semibold leading-none text-stone-950 tabular-nums">
              {money(debtSnapshot.debtToDate, locale)}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600" data-testid="employee-payroll-formula">
              {t(
                `Как считается на сегодня: все отработанные смены (${debtSnapshot.workedCountTotalToDate}) по ставкам = ${money(debtSnapshot.accruedToDate, locale)}. Минус подтвержденные выплаты ${money(debtSnapshot.paidToDate, locale)} = ${money(debtSnapshot.debtToDate, locale)}. Выбранный месяц отдельно: начислено ${money(stats.earnedActual, locale)} - выплаты ${money(stats.paidApproved, locale)} = ${money(stats.dueNow, locale)}.`,
                `Calculation to date: all worked shifts (${debtSnapshot.workedCountTotalToDate}) by rates = ${money(debtSnapshot.accruedToDate, locale)}. Minus approved payments ${money(debtSnapshot.paidToDate, locale)} = ${money(debtSnapshot.debtToDate, locale)}. Selected month separately: accrued ${money(stats.earnedActual, locale)} - payments ${money(stats.paidApproved, locale)} = ${money(stats.dueNow, locale)}.`,
              )}
            </p>
          </div>

          <Button variant="outline" onClick={onExport} className="justify-self-start lg:justify-self-end">
            <FileSpreadsheet className="h-4 w-4" />
            {copy.employee.downloadPayslip}
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <EmployeeFact
          label={copy.employee.stats.workedCount}
          value={`${stats.workedCount} / ${monthWorkdayTotal} · ${t('всего', 'total')} ${debtSnapshot.workedCountTotalToDate}`}
          helper={copy.employee.stats.workedCountHint}
        />
        <EmployeeFact label={copy.employee.stats.earnedActual} value={money(stats.earnedActual, locale)} />
        <EmployeeFact label={copy.employee.stats.paidApproved} value={money(stats.paidApproved, locale)} />
        <EmployeeFact label={t('Остаток выбранного месяца', 'Selected month balance')} value={money(stats.dueNow, locale)} />
        <EmployeeFact
          label={copy.employee.stats.forecastTotal}
          value={money(stats.forecastTotal, locale)}
          helper={plannedFutureAmount > 0
            ? t(`Будущие смены: ${money(plannedFutureAmount, locale)}`, `Future shifts: ${money(plannedFutureAmount, locale)}`)
            : t('Будущих смен по графику нет.', 'No future shifts are scheduled.')}
        />
      </section>

      <Card className="rounded-lg">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-base font-semibold">
              {t('Мои выплаты за месяц', 'My payments this month')}
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-stone-500">
              <Clock3 className="h-3.5 w-3.5" />
              {copy.employee.pendingPayments(pendingCount)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentPayments.length > 0 ? (
            <div className="grid gap-2">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm sm:grid-cols-[104px_1fr_auto] sm:items-center"
                  data-testid="employee-payment-row"
                >
                  <div className="font-medium text-stone-700">{payment.date}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-950 tabular-nums">{money(payment.amount, locale)}</div>
                    <div className="truncate text-xs text-stone-500">{payment.comment.trim() || t('Без комментария', 'No comment')}</div>
                  </div>
                  <PaymentStatusBadge status={payment.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-sm text-stone-500">
              {t('За выбранный месяц выплат пока нет.', 'There are no payments for the selected month yet.')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeFact({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-stone-950 tabular-nums">{value}</div>
      {helper ? (
        <div className="mt-1 text-xs leading-5 text-stone-500">{helper}</div>
      ) : null}
    </div>
  );
}
