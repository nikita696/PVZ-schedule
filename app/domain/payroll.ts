import { parseLocalDate, isDateOnOrBeforeToday } from '../lib/date';
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

const calculateStats = (
  source: PayrollSource,
  employeeId: string,
  isShiftIncluded: (date: Date) => boolean,
  isPaymentIncluded: (date: Date) => boolean,
): EmployeeStats => {
  const employee = source.employees.find((item) => item.id === employeeId);
  if (!employee) {
    return { shiftsWorked: 0, earned: 0, paid: 0, due: 0 };
  }

  const eligibleShifts = source.shifts.filter((shift) => (
    shift.employeeId === employeeId &&
    shift.status === 'working' &&
    isShiftIncluded(parseLocalDate(shift.date))
  ));

  const shiftsWorked = eligibleShifts.length;
  const earned = eligibleShifts.reduce((sum, shift) => sum + shift.rateSnapshot, 0);

  const paid = source.payments
    .filter((payment) => payment.employeeId === employeeId && isPaymentIncluded(parseLocalDate(payment.date)))
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    shiftsWorked,
    earned,
    paid,
    due: earned - paid,
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
      date.getFullYear() === year &&
      isDateOnOrBeforeToday(date)
    ),
    (date) => (
      date.getMonth() + 1 === month &&
      date.getFullYear() === year &&
      isDateOnOrBeforeToday(date)
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
    (date) => isDateOnOrBeforeToday(date),
    (date) => isDateOnOrBeforeToday(date),
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
    (date) => isDateOnOrBeforeToday(date) && date.getFullYear() < year,
    (date) => date.getFullYear() < year,
  );

  let runningBalance = opening.due;

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthStats = getEmployeeStats(source, employeeId, month, year);
    const delta = monthStats.earned - monthStats.paid;
    runningBalance += delta;

    return {
      month,
      shiftsWorked: monthStats.shiftsWorked,
      accrued: monthStats.earned,
      paid: monthStats.paid,
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
      (date) => isDateOnOrBeforeToday(date) && date.getFullYear() < year,
      (date) => date.getFullYear() < year,
    );
    return sum + previous.due;
  }, 0);

  let runningBalance = openingBalance;

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const total = employeeIds.reduce((acc, employeeId) => {
      const stats = getEmployeeStats(source, employeeId, month, year);
      acc.shiftsWorked += stats.shiftsWorked;
      acc.accrued += stats.earned;
      acc.paid += stats.paid;
      return acc;
    }, { shiftsWorked: 0, accrued: 0, paid: 0 });

    const delta = total.accrued - total.paid;
    runningBalance += delta;

    return {
      month,
      shiftsWorked: total.shiftsWorked,
      accrued: total.accrued,
      paid: total.paid,
      delta,
      balanceEnd: runningBalance,
    };
  });
};
