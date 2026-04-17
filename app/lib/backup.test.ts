import { describe, expect, it } from 'vitest';
import { createBackupPayload, parseBackupPayload } from './backup';
import type { AppDataSnapshot } from '../domain/types';

const snapshot: AppDataSnapshot = {
  employees: [
    {
      id: 'employee-1',
      userId: 'owner-1',
      organizationId: 'org-1',
      profileId: 'profile-1',
      authUserId: 'auth-1',
      workEmail: 'nikita@example.com',
      status: 'active',
      createdByProfileId: 'owner-profile',
      isOwner: false,
      hiredAt: '2025-01-01',
      terminatedAt: null,
      name: 'Nikita',
      dailyRate: 2500,
      archived: false,
      archivedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ],
  rateHistory: [
    {
      id: 'rate-1',
      employeeId: 'employee-1',
      organizationId: 'org-1',
      rate: 2500,
      validFrom: '2025-01-01',
      validTo: null,
      createdByProfileId: 'owner-profile',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
  scheduleMonths: [
    {
      id: 'month-1',
      organizationId: 'org-1',
      year: 2025,
      month: 1,
      status: 'approved',
      approvedByProfileId: 'owner-profile',
      approvedAt: '2025-01-01T00:00:00.000Z',
      closedByProfileId: null,
      closedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ],
  shifts: [
    {
      id: 'shift-1',
      userId: 'owner-1',
      organizationId: 'org-1',
      employeeId: 'employee-1',
      date: '2025-01-10',
      status: 'shift',
      requestedStatus: 'shift',
      approvedStatus: 'shift',
      actualStatus: 'shift',
      rateSnapshot: 2500,
      createdByProfileId: 'owner-profile',
      requestedByProfileId: 'owner-profile',
      approvedByProfileId: 'owner-profile',
      actualByProfileId: 'owner-profile',
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
  ],
  payments: [
    {
      id: 'payment-1',
      userId: 'owner-1',
      organizationId: 'org-1',
      employeeId: 'employee-1',
      amount: 2000,
      date: '2025-01-11',
      comment: 'Advance',
      status: 'approved',
      requestedByAuthUserId: 'auth-owner',
      approvedByAuthUserId: 'auth-owner',
      requestedByProfileId: 'owner-profile',
      approvedByProfileId: 'owner-profile',
      approvedAt: '2025-01-11T00:00:00.000Z',
      editedByAdmin: false,
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
          hiredAt: '2025-01-01',
          terminatedAt: null,
          archived: false,
        },
      ],
      rateHistory: [
        {
          employeeId: 'employee-1',
          rate: 2500,
          validFrom: '2025-01-01',
          validTo: null,
        },
      ],
      scheduleMonths: [
        {
          year: 2025,
          month: 1,
          status: 'approved',
        },
      ],
      shifts: [
        {
          employeeId: 'employee-1',
          date: '2025-01-10',
          requestedStatus: 'shift',
          approvedStatus: 'shift',
          actualStatus: 'shift',
          rateSnapshot: 2500,
        },
      ],
      payments: [
        {
          employeeId: 'employee-1',
          amount: 2000,
          date: '2025-01-11',
          comment: 'Advance',
          status: 'approved',
        },
      ],
      selectedMonth: 1,
      selectedYear: 2025,
    });
  });

  it('parses a legacy payload with old statuses', () => {
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
        payments: [
          {
            employeeId: 'employee-1',
            amount: 1000,
            date: '2099-02-03',
            status: 'entered',
          },
        ],
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
          hiredAt: null,
          terminatedAt: null,
          archived: false,
        },
      ],
      rateHistory: [
        {
          employeeId: 'employee-1',
          rate: 3000,
          validFrom: '2000-01-01',
          validTo: null,
        },
      ],
      scheduleMonths: [],
      shifts: [
        {
          employeeId: 'employee-1',
          date: '2099-02-02',
          requestedStatus: 'shift',
          approvedStatus: 'shift',
          actualStatus: null,
          rateSnapshot: 3000,
        },
      ],
      payments: [
        {
          employeeId: 'employee-1',
          amount: 1000,
          date: '2099-02-03',
          comment: '',
          status: 'pending',
        },
      ],
      selectedMonth: 2,
      selectedYear: 2099,
    });
  });
});
