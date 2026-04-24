import { describe, expect, it } from 'vitest';
import { buildDashboardPayrollSummary } from './dashboardPayroll';
import type { Employee, Payment, Shift } from './types';

const employee = (overrides: Partial<Employee>): Employee => ({
  id: 'emp-1',
  userId: 'owner-1',
  organizationId: 'org-1',
  profileId: null,
  authUserId: null,
  workEmail: null,
  status: 'active',
  createdByProfileId: 'profile-owner',
  isOwner: false,
  hiredAt: '2025-01-01',
  terminatedAt: null,
  name: 'Employee',
  dailyRate: 5000,
  archived: false,
  archivedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const shift = (id: string, employeeId: string, date: string, rateSnapshot: number): Shift => ({
  id,
  userId: 'owner-1',
  organizationId: 'org-1',
  employeeId,
  date,
  status: 'shift',
  requestedStatus: 'shift',
  approvedStatus: 'shift',
  actualStatus: 'shift',
  rateSnapshot,
  createdByProfileId: 'profile-owner',
  requestedByProfileId: 'profile-owner',
  approvedByProfileId: 'profile-owner',
  actualByProfileId: 'profile-owner',
  createdAt: '2025-04-01T00:00:00.000Z',
  updatedAt: '2025-04-01T00:00:00.000Z',
});

const payment = (
  id: string,
  employeeId: string,
  amount: number,
  status: Payment['status'],
): Payment => ({
  id,
  userId: 'owner-1',
  organizationId: 'org-1',
  employeeId,
  amount,
  date: '2025-04-20',
  comment: '',
  status,
  requestedByAuthUserId: 'owner-1',
  approvedByAuthUserId: status === 'approved' ? 'owner-1' : null,
  requestedByProfileId: 'profile-owner',
  approvedByProfileId: status === 'approved' ? 'profile-owner' : null,
  approvedAt: status === 'approved' ? '2025-04-20T00:00:00.000Z' : null,
  editedByAdmin: false,
  createdAt: '2025-04-20T00:00:00.000Z',
  updatedAt: '2025-04-20T00:00:00.000Z',
});

const employees = [
  employee({ id: 'emp-owner', name: 'Tatiana', isOwner: true, dailyRate: 0 }),
  employee({ id: 'emp-nick', name: 'Nick', dailyRate: 5000 }),
  employee({ id: 'emp-pavel', name: 'Pavel', dailyRate: 4000 }),
  employee({ id: 'emp-old', name: 'Archived', archived: true, status: 'archived' }),
];

describe('buildDashboardPayrollSummary', () => {
  it('calculates outstanding payroll from approved payments only', () => {
    const summary = buildDashboardPayrollSummary({
      employees,
      shifts: [
        shift('shift-nick-1', 'emp-nick', '2025-04-01', 5000),
        shift('shift-nick-2', 'emp-nick', '2025-04-02', 5000),
        shift('shift-pavel-1', 'emp-pavel', '2025-04-03', 4000),
      ],
      payments: [
        payment('payment-nick-approved', 'emp-nick', 6000, 'approved'),
        payment('payment-nick-pending', 'emp-nick', 1000, 'pending'),
        payment('payment-nick-rejected', 'emp-nick', 9000, 'rejected'),
        payment('payment-pavel-approved', 'emp-pavel', 4000, 'approved'),
      ],
    }, 4, 2025, 'approved');

    expect(summary.rows.map((row) => row.employee.id)).toEqual(['emp-nick', 'emp-pavel']);
    expect(summary.totals.earnedActual).toBe(14000);
    expect(summary.totals.paidApproved).toBe(10000);
    expect(summary.totals.outstandingDue).toBe(4000);
    expect(summary.pendingPayments).toEqual({ count: 1, amount: 1000 });
    expect(summary.closeState).toMatchObject({
      scheduleApproved: true,
      hasPendingPayments: true,
      hasOutstandingDue: true,
      canClose: false,
    });
  });

  it('allows closing only after schedule approval, no pending requests, and no positive balances', () => {
    const source = {
      employees,
      shifts: [
        shift('shift-nick-1', 'emp-nick', '2025-04-01', 5000),
        shift('shift-pavel-1', 'emp-pavel', '2025-04-03', 4000),
      ],
      payments: [
        payment('payment-nick-approved', 'emp-nick', 5000, 'approved'),
        payment('payment-pavel-approved', 'emp-pavel', 4000, 'approved'),
      ],
    };

    expect(buildDashboardPayrollSummary(source, 4, 2025, 'draft').closeState).toMatchObject({
      scheduleApproved: false,
      canApprove: true,
      canClose: false,
    });
    expect(buildDashboardPayrollSummary(source, 4, 2025, 'approved').closeState).toMatchObject({
      scheduleApproved: true,
      canClose: true,
    });
  });

  it('keeps an owner row only when it has payroll activity in the month', () => {
    const summary = buildDashboardPayrollSummary({
      employees,
      shifts: [shift('shift-owner', 'emp-owner', '2025-04-01', 3000)],
      payments: [],
    }, 4, 2025, 'approved');

    expect(summary.rows.map((row) => row.employee.id)).toContain('emp-owner');
  });
});
