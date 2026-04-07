import { describe, expect, it } from 'vitest';
import { createBackupPayload, parseBackupPayload } from './backup';
import type { AppDataSnapshot } from '../domain/types';

const snapshot: AppDataSnapshot = {
  employees: [
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
  ],
  shifts: [
    {
      id: 'shift-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      date: '2025-01-10',
      status: 'worked',
      rateSnapshot: 2500,
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
  ],
  payments: [
    {
      id: 'payment-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      amount: 2000,
      date: '2025-01-11',
      comment: 'Advance',
      status: 'confirmed',
      createdByAuthUserId: 'auth-owner',
      confirmedByAuthUserId: 'auth-owner',
      createdAt: '2025-01-11T00:00:00.000Z',
      updatedAt: '2025-01-11T00:00:00.000Z',
    },
  ],
  preferences: {
    selectedMonth: 1,
    selectedYear: 2025,
  },
};

describe('backup helpers', () => {
  it('creates and parses the current backup payload', () => {
    const payload = createBackupPayload(snapshot);
    const parsed = parseBackupPayload(payload);

    expect(parsed).toEqual({
      employees: [
        {
          id: 'employee-1',
          name: 'Nikita',
          dailyRate: 2500,
          archived: false,
        },
      ],
      shifts: [
        {
          employeeId: 'employee-1',
          date: '2025-01-10',
          status: 'worked',
          rateSnapshot: 2500,
        },
      ],
      payments: [
        {
          employeeId: 'employee-1',
          amount: 2000,
          date: '2025-01-11',
          comment: 'Advance',
          status: 'confirmed',
        },
      ],
      selectedMonth: 1,
      selectedYear: 2025,
    });
  });

  it('parses a legacy payload with dailyRate and working status', () => {
    const parsed = parseBackupPayload({
      state: {
        employees: [
          {
            id: 'employee-1',
            name: 'Pavel',
            dailyRate: 3000,
          },
        ],
        shifts: [
          {
            employeeId: 'employee-1',
            date: '2099-02-02',
            status: 'working',
            dailyRate: 3000,
          },
        ],
        payments: [],
        selectedMonth: 2,
        selectedYear: 2099,
      },
    });

    expect(parsed).toEqual({
      employees: [
        {
          id: 'employee-1',
          name: 'Pavel',
          dailyRate: 3000,
          archived: false,
        },
      ],
      shifts: [
        {
          employeeId: 'employee-1',
          date: '2099-02-02',
          status: 'planned-work',
          rateSnapshot: 3000,
        },
      ],
      payments: [],
      selectedMonth: 2,
      selectedYear: 2099,
    });
  });
});
