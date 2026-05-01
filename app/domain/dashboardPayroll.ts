import { getEmployeeStats } from './payroll';
import type { Employee, EmployeeRateHistory, EmployeeStats, Payment, Shift } from './types';

export interface DashboardPayrollSource {
  employees: Employee[];
  rateHistory?: EmployeeRateHistory[];
  shifts: Shift[];
  payments: Payment[];
}

export interface DashboardPayrollEmployeeRow {
  employee: Employee;
  stats: EmployeeStats;
  monthPaymentCount: number;
  outstandingDue: number;
  plannedFutureAmount: number;
  reserveToMonthEnd: number;
  hasMonthActivity: boolean;
}

export interface DashboardPayrollSummary {
  rows: DashboardPayrollEmployeeRow[];
  totals: {
    earnedActual: number;
    paidApproved: number;
    dueNow: number;
    outstandingDue: number;
    forecastTotal: number;
    plannedFutureAmount: number;
    reserveToMonthEnd: number;
    workedCount: number;
    plannedCount: number;
  };
  pendingPayments: {
    count: number;
    amount: number;
  };
}

const isInMonth = (date: string, month: number, year: number): boolean => {
  const [dateYear, dateMonth] = date.split('-').map(Number);
  return dateYear === year && dateMonth === month;
};

const hasEmployeeMonthPayment = (
  payments: Payment[],
  employeeId: string,
  month: number,
  year: number,
): boolean => payments.some((payment) => (
  payment.employeeId === employeeId && isInMonth(payment.date, month, year)
));

const hasStatsActivity = (stats: EmployeeStats): boolean => (
  stats.workedCount > 0 ||
  stats.plannedCount > 0 ||
  stats.sickCount > 0 ||
  stats.dayOffCount > 0 ||
  stats.earnedActual !== 0 ||
  stats.paidApproved !== 0 ||
  stats.dueNow !== 0 ||
  stats.forecastTotal !== 0
);

export const buildDashboardPayrollSummary = (
  source: DashboardPayrollSource,
  month: number,
  year: number,
): DashboardPayrollSummary => {
  const rows = source.employees
    .map((employee): DashboardPayrollEmployeeRow => {
      const stats = getEmployeeStats(source, employee.id, month, year);
      const monthPaymentCount = source.payments.filter((payment) => (
        payment.employeeId === employee.id && isInMonth(payment.date, month, year)
      )).length;
      const plannedFutureAmount = Math.max(0, stats.forecastTotal - stats.earnedActual);
      const outstandingDue = Math.max(0, stats.dueNow);
      const reserveToMonthEnd = Math.max(0, stats.forecastTotal - stats.paidApproved);
      const hasMonthActivity = hasStatsActivity(stats) || monthPaymentCount > 0;

      return {
        employee,
        stats,
        monthPaymentCount,
        outstandingDue,
        plannedFutureAmount,
        reserveToMonthEnd,
        hasMonthActivity,
      };
    })
    .filter((row) => {
      if (row.employee.isOwner && !row.hasMonthActivity) {
        return false;
      }

      if (row.employee.archived && !row.hasMonthActivity) {
        return false;
      }

      return true;
    });

  const pendingMonthPayments = source.payments.filter((payment) => (
    payment.status === 'pending' && isInMonth(payment.date, month, year)
  ));

  const totals = rows.reduce((acc, row) => ({
    earnedActual: acc.earnedActual + row.stats.earnedActual,
    paidApproved: acc.paidApproved + row.stats.paidApproved,
    dueNow: acc.dueNow + row.stats.dueNow,
    outstandingDue: acc.outstandingDue + row.outstandingDue,
    forecastTotal: acc.forecastTotal + row.stats.forecastTotal,
    plannedFutureAmount: acc.plannedFutureAmount + row.plannedFutureAmount,
    reserveToMonthEnd: acc.reserveToMonthEnd + row.reserveToMonthEnd,
    workedCount: acc.workedCount + row.stats.workedCount,
    plannedCount: acc.plannedCount + row.stats.plannedCount,
  }), {
    earnedActual: 0,
    paidApproved: 0,
    dueNow: 0,
    outstandingDue: 0,
    forecastTotal: 0,
    plannedFutureAmount: 0,
    reserveToMonthEnd: 0,
    workedCount: 0,
    plannedCount: 0,
  });

  return {
    rows,
    totals,
    pendingPayments: {
      count: pendingMonthPayments.length,
      amount: pendingMonthPayments.reduce((sum, payment) => sum + payment.amount, 0),
    },
  };
};

export const employeeHasMonthPayrollActivity = (
  source: Pick<DashboardPayrollSource, 'payments'>,
  employee: Employee,
  stats: EmployeeStats,
  month: number,
  year: number,
): boolean => (
  hasStatsActivity(stats) || hasEmployeeMonthPayment(source.payments, employee.id, month, year)
);
