import { describe, expect, it } from 'vitest';
import { getCompanyMonthlyBreakdown, getEmployeeLifetimeStats, getEmployeeStats } from './payroll';
import type { Employee, Payment, Shift } from './types';

const employees: Employee[] = [
  {
    id: 'employee-1',
    userId: 'user-1',
    name: 'Никита',
    dailyRate: 2500,
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'employee-2',
    userId: 'user-1',
    name: 'Павел',
    dailyRate: 2800,
    archived: false,
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
    status: 'working',
    rateSnapshot: 2500,
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-03T00:00:00.000Z',
  },
  {
    id: 'shift-2',
    userId: 'user-1',
    employeeId: 'employee-1',
    date: '2025-01-05',
    status: 'working',
    rateSnapshot: 2500,
    createdAt: '2025-01-05T00:00:00.000Z',
    updatedAt: '2025-01-05T00:00:00.000Z',
  },
  {
    id: 'shift-3',
    userId: 'user-1',
    employeeId: 'employee-2',
    date: '2024-12-28',
    status: 'working',
    rateSnapshot: 2800,
    createdAt: '2024-12-28T00:00:00.000Z',
    updatedAt: '2024-12-28T00:00:00.000Z',
  },
];

const payments: Payment[] = [
  {
    id: 'payment-1',
    userId: 'user-1',
    employeeId: 'employee-1',
    amount: 3000,
    date: '2025-01-10',
    comment: 'Аванс',
    createdAt: '2025-01-10T00:00:00.000Z',
    updatedAt: '2025-01-10T00:00:00.000Z',
  },
  {
    id: 'payment-2',
    userId: 'user-1',
    employeeId: 'employee-2',
    amount: 1000,
    date: '2024-12-30',
    comment: 'Частичная выплата',
    createdAt: '2024-12-30T00:00:00.000Z',
    updatedAt: '2024-12-30T00:00:00.000Z',
  },
];

const source = { employees, shifts, payments };

describe('payroll domain', () => {
  it('calculates employee stats for a month', () => {
    expect(getEmployeeStats(source, 'employee-1', 1, 2025)).toEqual({
      shiftsWorked: 2,
      earned: 5000,
      paid: 3000,
      due: 2000,
    });
  });

  it('calculates lifetime stats', () => {
    expect(getEmployeeLifetimeStats(source, 'employee-2')).toEqual({
      shiftsWorked: 1,
      earned: 2800,
      paid: 1000,
      due: 1800,
    });
  });

  it('carries opening balance into company monthly breakdown', () => {
    const breakdown = getCompanyMonthlyBreakdown(source, 2025);

    expect(breakdown[0]).toEqual({
      month: 1,
      shiftsWorked: 2,
      accrued: 5000,
      paid: 3000,
      delta: 2000,
      balanceEnd: 3800,
    });
  });
});
