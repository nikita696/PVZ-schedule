import type {
  AppDataSnapshot,
  ImportedAppData,
  ImportedEmployee,
  ImportedPayment,
  ImportedShift,
  PaymentStatus,
  ShiftStatusDb,
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
      archived: boolean;
    }>;
    shifts: Array<{
      employeeId: string;
      date: string;
      status: ShiftStatusDb;
      rateSnapshot: number;
    }>;
    payments: Array<{
      employeeId: string;
      amount: number;
      date: string;
      comment: string;
      status?: PaymentStatus;
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
  value === 'none'
);

const isPaymentStatus = (value: unknown): value is PaymentStatus => (
  value === 'pending_confirmation' || value === 'confirmed' || value === 'rejected'
);

export const createBackupPayload = (snapshot: AppDataSnapshot): BackupPayload => ({
  version: 2,
  source: 'pvz-schedule',
  exportedAt: new Date().toISOString(),
  state: {
    employees: snapshot.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      dailyRate: employee.dailyRate,
      archived: employee.archived,
    })),
    shifts: snapshot.shifts.map((shift) => ({
      employeeId: shift.employeeId,
      date: shift.date,
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
      archived: Boolean(item.archived),
    });
  }

  return employees;
};

const parseShifts = (
  shiftsRaw: unknown,
  employeeRateById: Map<string, number>,
): ImportedShift[] | null => {
  if (!Array.isArray(shiftsRaw)) return null;

  const shifts: ImportedShift[] = [];

  for (const item of shiftsRaw) {
    if (
      !isRecord(item) ||
      typeof item.employeeId !== 'string' ||
      !isValidDateString(item.date) ||
      !isLegacyShiftStatus(item.status)
    ) {
      return null;
    }

    const normalizedStatus = normalizeShiftStatus(item.status, item.date);
    if (!normalizedStatus) {
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
      status: normalizedStatus,
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
      status:
        item.status === 'entered'
          ? 'pending_confirmation'
          : isPaymentStatus(item.status)
            ? item.status
            : 'confirmed',
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
  const shifts = parseShifts(source.shifts, employeeRateById);
  const payments = parsePayments(source.payments);
  if (!shifts || !payments) return null;

  const defaults = getDefaultUiPreferences();
  const selectedMonth = typeof source.selectedMonth === 'number' ? source.selectedMonth : defaults.selectedMonth;
  const selectedYear = typeof source.selectedYear === 'number' ? source.selectedYear : defaults.selectedYear;

  if (selectedMonth < 1 || selectedMonth > 12) return null;
  if (!Number.isInteger(selectedYear) || selectedYear < 2000 || selectedYear > 2100) return null;

  return {
    employees,
    shifts,
    payments,
    selectedMonth,
    selectedYear,
  };
};
