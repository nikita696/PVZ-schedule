import { getLocalISODate, parseLocalDate } from '../lib/date';
import { isShiftLikeStatus } from './shiftStatus';
import type {
  EmployeeDebtSnapshot,
  Employee,
  EmployeeRateHistory,
  EmployeeStats,
  MonthlyBreakdownRow,
  Payment,
  Shift,
  ShiftStatusDb,
} from './types';

interface PayrollSource {
  employees: Employee[];
  rateHistory?: EmployeeRateHistory[];
  shifts: Shift[];
  payments: Payment[];
}

const isPastOrToday = (date: Date): boolean => {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return date <= todayEnd;
};

const isFuture = (date: Date): boolean => !isPastOrToday(date);

const resolveDisplayStatus = (shift: Shift): ShiftStatusDb => (
  shift.actualStatus ?? shift.approvedStatus ?? shift.requestedStatus ?? shift.status
);

const resolveActualStatus = (shift: Shift, date: Date): ShiftStatusDb | null => {
  if (shift.actualStatus) return shift.actualStatus;
  if (isPastOrToday(date)) return shift.approvedStatus ?? shift.requestedStatus ?? shift.status ?? null;
  return null;
};

const resolveForecastStatus = (shift: Shift): ShiftStatusDb | null => (
  shift.approvedStatus ?? shift.requestedStatus ?? shift.status ?? null
);

const getEffectiveRate = (
  source: PayrollSource,
  employee: Employee,
  workDate: string,
): number => {
  const history = (source.rateHistory ?? [])
    .filter((item) => item.employeeId === employee.id)
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom));

  const matched = history.find((item) => (
    item.validFrom <= workDate &&
    (item.validTo === null || item.validTo >= workDate)
  ));

  return matched?.rate ?? employee.dailyRate;
};

const getShiftRate = (
  source: PayrollSource,
  employee: Employee,
  shift: Shift,
): number => shift.rateSnapshot > 0 ? shift.rateSnapshot : getEffectiveRate(source, employee, shift.date);

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
      dayOffCount: 0,
      earnedActual: 0,
      paidApproved: 0,
      dueNow: 0,
      forecastTotal: 0,
    };
  }

  const eligibleShifts = source.shifts.filter((shift) => (
    shift.employeeId === employeeId &&
    isShiftIncluded(parseLocalDate(shift.date))
  ));

  const workedShifts = eligibleShifts.filter((shift) => {
    const status = resolveActualStatus(shift, parseLocalDate(shift.date));
    return isShiftLikeStatus(status);
  });

  const plannedFutureShifts = eligibleShifts.filter((shift) => {
    const date = parseLocalDate(shift.date);
    const status = resolveForecastStatus(shift);
    return isFuture(date) && isShiftLikeStatus(status);
  });

  const sickCount = eligibleShifts.filter((shift) => (
    resolveDisplayStatus(shift) === 'sick_leave'
  )).length;

  const dayOffCount = eligibleShifts.filter((shift) => {
    const status = resolveDisplayStatus(shift);
    return status === 'day_off' || status === 'no_shift';
  }).length;

  const workedCount = workedShifts.length;
  const plannedCount = plannedFutureShifts.length;
  const earnedActual = workedShifts.reduce(
    (sum, shift) => sum + getShiftRate(source, employee, shift),
    0,
  );

  const paidApproved = source.payments
    .filter((payment) => (
      payment.employeeId === employeeId &&
      payment.status === 'approved' &&
      isPaymentIncluded(parseLocalDate(payment.date))
    ))
    .reduce((sum, payment) => sum + payment.amount, 0);

  const forecastTotal = earnedActual + plannedFutureShifts.reduce(
    (sum, shift) => sum + getShiftRate(source, employee, shift),
    0,
  );

  return {
    workedCount,
    plannedCount,
    sickCount,
    dayOffCount,
    earnedActual,
    paidApproved,
    dueNow: earnedActual - paidApproved,
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
    (date) => date.getMonth() + 1 === month && date.getFullYear() === year,
    (date) => date.getMonth() + 1 === month && date.getFullYear() === year,
  )
);

export const getEmployeeLifetimeStats = (
  source: PayrollSource,
  employeeId: string,
): EmployeeStats => (
  calculateStats(source, employeeId, () => true, () => true)
);

export const getEmployeeDebtSnapshot = (
  source: PayrollSource,
  employeeId: string,
  todayDate: string = getLocalISODate(),
): EmployeeDebtSnapshot => {
  const employee = source.employees.find((item) => item.id === employeeId);
  if (!employee) {
    return {
      workedCountTotalToDate: 0,
      workedCountCurrentMonthToDate: 0,
      accruedToDate: 0,
      paidToDate: 0,
      debtToDate: 0,
    };
  }

  const currentMonthKey = todayDate.slice(0, 7);
  const workedShifts = source.shifts.filter((shift) => {
    if (shift.employeeId !== employeeId || shift.date > todayDate) {
      return false;
    }

    const status = shift.actualStatus ?? shift.approvedStatus ?? shift.requestedStatus ?? shift.status ?? null;
    return isShiftLikeStatus(status);
  });

  const accruedToDate = workedShifts.reduce(
    (sum, shift) => sum + getShiftRate(source, employee, shift),
    0,
  );

  const paidToDate = source.payments
    .filter((payment) => (
      payment.employeeId === employeeId &&
      payment.status !== 'rejected' &&
      payment.date <= todayDate
    ))
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    workedCountTotalToDate: workedShifts.length,
    workedCountCurrentMonthToDate: workedShifts.filter((shift) => shift.date.startsWith(currentMonthKey)).length,
    accruedToDate,
    paidToDate,
    debtToDate: accruedToDate - paidToDate,
  };
};

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
    const delta = monthStats.earnedActual - monthStats.paidApproved;
    runningBalance += delta;

    return {
      month,
      workedCount: monthStats.workedCount,
      sickCount: monthStats.sickCount,
      dayOffCount: monthStats.dayOffCount,
      earnedActual: monthStats.earnedActual,
      paidApproved: monthStats.paidApproved,
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
      acc.dayOffCount += stats.dayOffCount;
      acc.earnedActual += stats.earnedActual;
      acc.paidApproved += stats.paidApproved;
      acc.forecastTotal += stats.forecastTotal;
      return acc;
    }, {
      workedCount: 0,
      sickCount: 0,
      dayOffCount: 0,
      earnedActual: 0,
      paidApproved: 0,
      forecastTotal: 0,
    });

    const delta = total.earnedActual - total.paidApproved;
    runningBalance += delta;

    return {
      month,
      workedCount: total.workedCount,
      sickCount: total.sickCount,
      dayOffCount: total.dayOffCount,
      earnedActual: total.earnedActual,
      paidApproved: total.paidApproved,
      forecastTotal: total.forecastTotal,
      delta,
      balanceEnd: runningBalance,
    };
  });
};
