import { describe, expect, it } from 'vitest';
import { getCompanyMonthlyBreakdown, getEmployeeLifetimeStats, getEmployeeStats } from './payroll';
import type { Employee, Payment, Shift } from './types';

const employees: Employee[] = [
  {
    id: 'employee-1',
    userId: 'user-1',
    authUserId: 'auth-1',
    inviteCode: null,
    isOwner: false,
    hiredAt: '2025-01-01',
    name: 'Nikita',
    dailyRate: 2500,
    archived: false,
    archivedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'employee-2',
    userId: 'user-1',
    authUserId: 'auth-2',
    inviteCode: null,
    isOwner: false,
    hiredAt: '2025-01-01',
    name: 'Pavel',
    dailyRate: 2800,
    archived: false,
    archivedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

const shifts: Shift[] = [
  {
    id: 'shift-1',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2025-01-03',
    status: 'worked',
    rateSnapshot: 2500,
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-03T00:00:00.000Z',
  },
  {
    id: 'shift-2',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2025-01-05',
    status: 'worked',
    rateSnapshot: 2500,
    createdAt: '2025-01-05T00:00:00.000Z',
    updatedAt: '2025-01-05T00:00:00.000Z',
  },
  {
    id: 'shift-3',
    userId: 'user-1',
    employeeId: 'employee-2',
    date: '2024-12-28',
    status: 'worked',
    rateSnapshot: 2800,
    createdAt: '2024-12-28T00:00:00.000Z',
    updatedAt: '2024-12-28T00:00:00.000Z',
  },
  {
    id: 'shift-4',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2099-01-10',
    status: 'planned-work',
    rateSnapshot: 2500,
    createdAt: '2099-01-10T00:00:00.000Z',
    updatedAt: '2099-01-10T00:00:00.000Z',
  },
  {
    id: 'shift-5',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2025-01-11',
    status: 'sick',
    rateSnapshot: 2500,
    createdAt: '2025-01-11T00:00:00.000Z',
    updatedAt: '2025-01-11T00:00:00.000Z',
  },
  {
    id: 'shift-6',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2025-01-12',
    status: 'vacation',
    rateSnapshot: 2500,
    createdAt: '2025-01-12T00:00:00.000Z',
    updatedAt: '2025-01-12T00:00:00.000Z',
  },
];

const payments: Payment[] = [
  {
    id: 'payment-1',
    userId: 'user-1',
    employeeId: 'employee-1',
    amount: 3000,
    date: '2025-01-10',
    comment: 'Advance',
    status: 'confirmed',
    createdByAuthUserId: 'auth-owner',
    confirmedByAuthUserId: 'auth-owner',
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
  },
  {
    id: 'payment-2',
    userId: 'user-1',
    employeeId: 'employee-2',
    amount: 1000,
    date: '2024-12-30',
    comment: 'Partial payment',
    status: 'confirmed',
    createdByAuthUserId: 'auth-owner',
    confirmedByAuthUserId: 'auth-owner',
    createdAt: '2024-12-30T00:00:00.000Z',
    updatedAt: '2024-12-30T00:00:00.000Z',
  },
  {
    id: 'payment-3',
    userId: 'user-1',
    employeeId: 'employee-1',
    amount: 600,
    date: '2025-01-09',
    comment: 'Pending employee claim',
    status: 'entered',
    createdByAuthUserId: 'auth-1',
    confirmedByAuthUserId: null,
    createdAt: '2025-01-09T00:00:00.000Z',
    updatedAt: '2025-01-09T00:00:00.000Z',
  },
];

const source = { employees, shifts, payments };

describe('payroll domain', () => {
  it('calculates monthly stats with worked/sick/vacation split', () => {
    expect(getEmployeeStats(source, 'employee-1', 1, 2025)).toEqual({
      workedCount: 2,
      plannedCount: 0,
      sickCount: 1,
      vacationCount: 1,
      earnedActual: 5000,
      paidConfirmed: 3000,
      dueNow: 2000,
      forecastTotal: 5000,
    });
  });

  it('calculates lifetime stats with confirmed payments only', () => {
    expect(getEmployeeLifetimeStats(source, 'employee-2')).toEqual({
      workedCount: 1,
      plannedCount: 0,
      sickCount: 0,
      vacationCount: 0,
      earnedActual: 2800,
      paidConfirmed: 1000,
      dueNow: 1800,
      forecastTotal: 2800,
    });
  });

  it('includes future planned shifts in forecast_total', () => {
    expect(getEmployeeStats(source, 'employee-1', 1, 2099)).toEqual({
      workedCount: 0,
      plannedCount: 1,
      sickCount: 0,
      vacationCount: 0,
      earnedActual: 0,
      paidConfirmed: 0,
      dueNow: 0,
      forecastTotal: 2500,
    });
  });

  it('carries opening balance into company monthly breakdown', () => {
    const breakdown = getCompanyMonthlyBreakdown(source, 2025);

    expect(breakdown[0]).toEqual({
      month: 1,
      workedCount: 2,
      sickCount: 1,
      vacationCount: 1,
      earnedActual: 5000,
      paidConfirmed: 3000,
      forecastTotal: 5000,
      delta: 2000,
      balanceEnd: 3800,
    });
  });
});
