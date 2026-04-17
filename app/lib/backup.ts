import type {
  AppDataSnapshot,
  ImportedAppData,
  ImportedEmployee,
  ImportedEmployeeRateHistory,
  ImportedPayment,
  ImportedScheduleMonth,
  ImportedShift,
  PaymentStatus,
} from '../domain/types';
import { normalizeShiftStatus, type LegacyShiftStatus } from '../domain/shiftStatus';
import { getDefaultUiPreferences, isValidDateString } from './date';

interface BackupPayload {
  version: number;
  source: string;
  exportedAt: string;
  state: {
    employees: Array<{
      id: string;
      name: string;
      dailyRate: number;
      hiredAt?: string | null;
      terminatedAt?: string | null;
      archived: boolean;
    }>;
    rateHistory?: Array<{
      employeeId: string;
      rate: number;
      validFrom: string;
      validTo?: string | null;
    }>;
    scheduleMonths?: Array<{
      year: number;
      month: number;
      status: 'draft' | 'pending_approval' | 'approved' | 'closed';
    }>;
    shifts: Array<{
      employeeId: string;
      date: string;
      requestedStatus?: string | null;
      approvedStatus?: string | null;
      actualStatus?: string | null;
      status?: string;
      rateSnapshot: number;
      dailyRate?: number;
    }>;
    payments: Array<{
      employeeId: string;
      amount: number;
      date: string;
      comment: string;
      status?: string;
    }>;
    selectedMonth: number;
    selectedYear: number;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isLegacyShiftStatus = (value: unknown): value is LegacyShiftStatus => (
  value === 'working' ||
  value === 'planned-work' ||
  value === 'worked' ||
  value === 'day-off' ||
  value === 'vacation' ||
  value === 'sick' ||
  value === 'no-show' ||
  value === 'shift' ||
  value === 'day_off' ||
  value === 'sick_leave' ||
  value === 'no_show' ||
  value === 'replacement' ||
  value === 'no_shift' ||
  value === 'none'
);

const normalizePaymentStatus = (value: unknown): PaymentStatus => {
  if (value === 'approved' || value === 'rejected' || value === 'pending') {
    return value;
  }

  if (value === 'confirmed') return 'approved';
  if (value === 'pending_confirmation' || value === 'entered') return 'pending';
  return 'approved';
};

export const createBackupPayload = (snapshot: AppDataSnapshot): BackupPayload => ({
  version: 3,
  source: 'pvz-schedule',
  exportedAt: new Date().toISOString(),
  state: {
    employees: snapshot.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      dailyRate: employee.dailyRate,
      hiredAt: employee.hiredAt,
      terminatedAt: employee.terminatedAt,
      archived: employee.archived,
    })),
    rateHistory: snapshot.rateHistory.map((item) => ({
      employeeId: item.employeeId,
      rate: item.rate,
      validFrom: item.validFrom,
      validTo: item.validTo,
    })),
    scheduleMonths: snapshot.scheduleMonths.map((item) => ({
      year: item.year,
      month: item.month,
      status: item.status,
    })),
    shifts: snapshot.shifts.map((shift) => ({
      employeeId: shift.employeeId,
      date: shift.date,
      requestedStatus: shift.requestedStatus,
      approvedStatus: shift.approvedStatus,
      actualStatus: shift.actualStatus,
      status: shift.status,
      rateSnapshot: shift.rateSnapshot,
    })),
    payments: snapshot.payments.map((payment) => ({
      employeeId: payment.employeeId,
      amount: payment.amount,
      date: payment.date,
      comment: payment.comment,
      status: payment.status,
    })),
    selectedMonth: snapshot.preferences.selectedMonth,
    selectedYear: snapshot.preferences.selectedYear,
  },
});

const parseEmployees = (employeesRaw: unknown): ImportedEmployee[] | null => {
  if (!Array.isArray(employeesRaw)) return null;

  const employees: ImportedEmployee[] = [];
  for (const item of employeesRaw) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.dailyRate !== 'number'
    ) {
      return null;
    }

    employees.push({
      id: item.id,
      name: item.name,
      dailyRate: item.dailyRate,
      hiredAt: isValidDateString(item.hiredAt) ? item.hiredAt : null,
      terminatedAt: isValidDateString(item.terminatedAt) ? item.terminatedAt : null,
      archived: Boolean(item.archived),
    });
  }

  return employees;
};

const parseRateHistory = (
  rateHistoryRaw: unknown,
  employees: ImportedEmployee[],
): ImportedEmployeeRateHistory[] | null => {
  if (!Array.isArray(rateHistoryRaw)) {
    return employees.map((employee) => ({
      employeeId: employee.id,
      rate: employee.dailyRate,
      validFrom: employee.hiredAt ?? '2000-01-01',
      validTo: employee.terminatedAt,
    }));
  }

  const rateHistory: ImportedEmployeeRateHistory[] = [];
  for (const item of rateHistoryRaw) {
    if (
      !isRecord(item) ||
      typeof item.employeeId !== 'string' ||
      typeof item.rate !== 'number' ||
      !isValidDateString(item.validFrom)
    ) {
      return null;
    }

    rateHistory.push({
      employeeId: item.employeeId,
      rate: item.rate,
      validFrom: item.validFrom,
      validTo: isValidDateString(item.validTo) ? item.validTo : null,
    });
  }

  return rateHistory;
};

const parseScheduleMonths = (monthsRaw: unknown): ImportedScheduleMonth[] | null => {
  if (!Array.isArray(monthsRaw)) return [];

  const months: ImportedScheduleMonth[] = [];
  for (const item of monthsRaw) {
    if (
      !isRecord(item) ||
      typeof item.year !== 'number' ||
      typeof item.month !== 'number' ||
      (item.status !== 'draft' &&
        item.status !== 'pending_approval' &&
        item.status !== 'approved' &&
        item.status !== 'closed')
    ) {
      return null;
    }

    months.push({
      year: item.year,
      month: item.month,
      status: item.status,
    });
  }

  return months;
};

const parseShifts = (
  shiftsRaw: unknown,
  employeeRateById: Map<string, number>,
): ImportedShift[] | null => {
  if (!Array.isArray(shiftsRaw)) return null;

  const shifts: ImportedShift[] = [];
  for (const item of shiftsRaw) {
    if (!isRecord(item) || typeof item.employeeId !== 'string' || !isValidDateString(item.date)) {
      return null;
    }

    const requestedStatus = isLegacyShiftStatus(item.requestedStatus)
      ? normalizeShiftStatus(item.requestedStatus, item.date)
      : null;
    const approvedStatus = isLegacyShiftStatus(item.approvedStatus)
      ? normalizeShiftStatus(item.approvedStatus, item.date)
      : null;
    const actualStatus = isLegacyShiftStatus(item.actualStatus)
      ? normalizeShiftStatus(item.actualStatus, item.date)
      : null;

    const legacyStatus = isLegacyShiftStatus(item.status)
      ? normalizeShiftStatus(item.status, item.date)
      : null;

    const effectiveStatus = requestedStatus ?? approvedStatus ?? actualStatus ?? legacyStatus;
    if (!effectiveStatus) {
      continue;
    }

    const rateSnapshot = typeof item.rateSnapshot === 'number'
      ? item.rateSnapshot
      : typeof item.dailyRate === 'number'
        ? item.dailyRate
        : employeeRateById.get(item.employeeId);

    if (typeof rateSnapshot !== 'number') {
      return null;
    }

    shifts.push({
      employeeId: item.employeeId,
      date: item.date,
      requestedStatus: requestedStatus ?? legacyStatus,
      approvedStatus: approvedStatus ?? legacyStatus,
      actualStatus,
      rateSnapshot,
    });
  }

  return shifts;
};

const parsePayments = (paymentsRaw: unknown): ImportedPayment[] | null => {
  if (!Array.isArray(paymentsRaw)) return null;

  const payments: ImportedPayment[] = [];
  for (const item of paymentsRaw) {
    if (
      !isRecord(item) ||
      typeof item.employeeId !== 'string' ||
      typeof item.amount !== 'number' ||
      !isValidDateString(item.date)
    ) {
      return null;
    }

    payments.push({
      employeeId: item.employeeId,
      amount: item.amount,
      date: item.date,
      comment: typeof item.comment === 'string' ? item.comment : '',
      status: normalizePaymentStatus(item.status),
    });
  }

  return payments;
};

export const parseBackupPayload = (payload: unknown): ImportedAppData | null => {
  if (!isRecord(payload)) return null;

  const source = isRecord(payload.state) ? payload.state : payload;
  const employees = parseEmployees(source.employees);
  if (!employees) return null;

  const employeeRateById = new Map(employees.map((employee) => [employee.id, employee.dailyRate]));
  const rateHistory = parseRateHistory(source.rateHistory, employees);
  const scheduleMonths = parseScheduleMonths(source.scheduleMonths);
  const shifts = parseShifts(source.shifts, employeeRateById);
  const payments = parsePayments(source.payments);

  if (!rateHistory || !scheduleMonths || !shifts || !payments) return null;

  const defaults = getDefaultUiPreferences();
  const selectedMonth = typeof source.selectedMonth === 'number' ? source.selectedMonth : defaults.selectedMonth;
  const selectedYear = typeof source.selectedYear === 'number' ? source.selectedYear : defaults.selectedYear;

  if (selectedMonth < 1 || selectedMonth > 12) return null;
  if (!Number.isInteger(selectedYear) || selectedYear < 2000 || selectedYear > 2100) return null;

  return {
    employees,
    rateHistory,
    scheduleMonths,
    shifts,
    payments,
    selectedMonth,
    selectedYear,
  };
};
