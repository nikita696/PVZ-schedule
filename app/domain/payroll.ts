import { parseLocalDate } from '../lib/date';
import type {
  Employee,
  EmployeeStats,
  MonthlyBreakdownRow,
  Payment,
  Shift,
} from './types';

interface PayrollSource {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
}

const isTodayOrFuture = (date: Date): boolean => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return date >= todayStart;
};

const calculateStats = (
  source: PayrollSource,
  employeeId: string,
  isShiftIncluded: (date: Date) => boolean,
  isPaymentIncluded: (date: Date) => boolean,
): EmployeeStats => {
  const employee = source.employees.find((item) => item.id === employeeId);
  if (!employee) {
    return {
      workedCount: 0,
      plannedCount: 0,
      sickCount: 0,
      vacationCount: 0,
      earnedActual: 0,
      paidConfirmed: 0,
      dueNow: 0,
      forecastTotal: 0,
    };
  }

  const eligibleShifts = source.shifts.filter((shift) => (
    shift.employeeId === employeeId &&
    isShiftIncluded(parseLocalDate(shift.date))
  ));

  const workedShifts = eligibleShifts.filter((shift) => shift.status === 'worked');
  const plannedFutureShifts = eligibleShifts.filter((shift) => (
    shift.status === 'planned-work' && isTodayOrFuture(parseLocalDate(shift.date))
  ));
  const sickCount = eligibleShifts.filter((shift) => shift.status === 'sick').length;
  const vacationCount = eligibleShifts.filter((shift) => shift.status === 'vacation').length;

  const workedCount = workedShifts.length;
  const plannedCount = plannedFutureShifts.length;
  const earnedActual = workedShifts.reduce((sum, shift) => sum + shift.rateSnapshot, 0);

  const paidConfirmed = source.payments
    .filter((payment) => (
      payment.employeeId === employeeId &&
      payment.status === 'confirmed' &&
      isPaymentIncluded(parseLocalDate(payment.date))
    ))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const forecastTotal = earnedActual + plannedFutureShifts.reduce((sum, shift) => sum + shift.rateSnapshot, 0);

  return {
    workedCount,
    plannedCount,
    sickCount,
    vacationCount,
    earnedActual,
    paidConfirmed,
    dueNow: earnedActual - paidConfirmed,
    forecastTotal,
  };
};

export const getEmployeeStats = (
  source: PayrollSource,
  employeeId: string,
  month: number,
  year: number,
): EmployeeStats => (
  calculateStats(
    source,
    employeeId,
    (date) => (
      date.getMonth() + 1 === month &&
      date.getFullYear() === year
    ),
    (date) => (
      date.getMonth() + 1 === month &&
      date.getFullYear() === year
    ),
  )
);

export const getEmployeeLifetimeStats = (
  source: PayrollSource,
  employeeId: string,
): EmployeeStats => (
  calculateStats(
    source,
    employeeId,
    () => true,
    () => true,
  )
);

export const getEmployeeMonthlyBreakdown = (
  source: PayrollSource,
  employeeId: string,
  year: number,
): MonthlyBreakdownRow[] => {
  const opening = calculateStats(
    source,
    employeeId,
    (date) => date.getFullYear() < year,
    (date) => date.getFullYear() < year,
  );

  let runningBalance = opening.dueNow;

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthStats = getEmployeeStats(source, employeeId, month, year);
    const delta = monthStats.earnedActual - monthStats.paidConfirmed;
    runningBalance += delta;

    return {
      month,
      workedCount: monthStats.workedCount,
      sickCount: monthStats.sickCount,
      vacationCount: monthStats.vacationCount,
      earnedActual: monthStats.earnedActual,
      paidConfirmed: monthStats.paidConfirmed,
      forecastTotal: monthStats.forecastTotal,
      delta,
      balanceEnd: runningBalance,
    };
  });
};

export const getCompanyMonthlyBreakdown = (
  source: PayrollSource,
  year: number,
): MonthlyBreakdownRow[] => {
  const employeeIds = source.employees.map((employee) => employee.id);

  const openingBalance = employeeIds.reduce((sum, employeeId) => {
    const previous = calculateStats(
      source,
      employeeId,
      (date) => date.getFullYear() < year,
      (date) => date.getFullYear() < year,
    );
    return sum + previous.dueNow;
  }, 0);

  let runningBalance = openingBalance;

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const total = employeeIds.reduce((acc, employeeId) => {
      const stats = getEmployeeStats(source, employeeId, month, year);
      acc.workedCount += stats.workedCount;
      acc.sickCount += stats.sickCount;
      acc.vacationCount += stats.vacationCount;
      acc.earnedActual += stats.earnedActual;
      acc.paidConfirmed += stats.paidConfirmed;
      acc.forecastTotal += stats.forecastTotal;
      return acc;
    }, {
      workedCount: 0,
      sickCount: 0,
      vacationCount: 0,
      earnedActual: 0,
      paidConfirmed: 0,
      forecastTotal: 0,
    });

    const delta = total.earnedActual - total.paidConfirmed;
    runningBalance += delta;

    return {
      month,
      workedCount: total.workedCount,
      sickCount: total.sickCount,
      vacationCount: total.vacationCount,
      earnedActual: total.earnedActual,
      paidConfirmed: total.paidConfirmed,
      forecastTotal: total.forecastTotal,
      delta,
      balanceEnd: runningBalance,
    };
  });
};
