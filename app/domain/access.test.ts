import { describe, expect, it } from 'vitest';
import {
  canConfirmPayment,
  canDeletePayment,
  canEditPayment,
  canRejectPayment,
  filterVisibleEmployees,
  filterVisiblePayments,
  filterVisibleShifts,
} from './access';
import type { Employee, Payment, Shift, UserAccess } from './types';

const employees: Employee[] = [
  {
    id: 'e1',
    userId: 'owner-1',
    organizationId: 'org-1',
    profileId: 'auth-e1',
    authUserId: 'auth-e1',
    workEmail: 'e1@example.com',
    status: 'active',
    createdByProfileId: 'owner-1',
    isOwner: false,
    hiredAt: null,
    terminatedAt: null,
    name: 'E1',
    dailyRate: 2500,
    archived: false,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'e2',
    userId: 'owner-1',
    organizationId: 'org-1',
    profileId: 'auth-e2',
    authUserId: 'auth-e2',
    workEmail: 'e2@example.com',
    status: 'active',
    createdByProfileId: 'owner-1',
    isOwner: false,
    hiredAt: null,
    terminatedAt: null,
    name: 'E2',
    dailyRate: 2500,
    archived: false,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const shifts: Shift[] = [
  {
    id: 's1',
    userId: 'owner-1',
    organizationId: 'org-1',
    employeeId: 'e1',
    date: '2026-04-10',
    status: 'shift',
    requestedStatus: 'shift',
    approvedStatus: 'shift',
    actualStatus: 'shift',
    rateSnapshot: 2500,
    createdByProfileId: 'auth-e1',
    requestedByProfileId: 'auth-e1',
    approvedByProfileId: 'owner-1',
    actualByProfileId: 'owner-1',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  {
    id: 's2',
    userId: 'owner-1',
    organizationId: 'org-1',
    employeeId: 'e2',
    date: '2026-04-10',
    status: 'replacement',
    requestedStatus: 'replacement',
    approvedStatus: 'replacement',
    actualStatus: null,
    rateSnapshot: 2500,
    createdByProfileId: 'owner-1',
    requestedByProfileId: 'owner-1',
    approvedByProfileId: 'owner-1',
    actualByProfileId: null,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
];

const payments: Payment[] = [
  {
    id: 'p1',
    userId: 'owner-1',
    organizationId: 'org-1',
    employeeId: 'e1',
    amount: 1000,
    date: '2026-04-11',
    comment: 'cash',
    status: 'pending',
    requestedByAuthUserId: 'auth-e1',
    approvedByAuthUserId: null,
    requestedByProfileId: 'auth-e1',
    approvedByProfileId: null,
    approvedAt: null,
    editedByAdmin: false,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    id: 'p2',
    userId: 'owner-1',
    organizationId: 'org-1',
    employeeId: 'e2',
    amount: 1500,
    date: '2026-04-11',
    comment: 'bank',
    status: 'approved',
    requestedByAuthUserId: 'owner-1',
    approvedByAuthUserId: 'owner-1',
    requestedByProfileId: 'owner-1',
    approvedByProfileId: 'owner-1',
    approvedAt: '2026-04-11T00:00:00.000Z',
    editedByAdmin: false,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
];

const adminAccess: UserAccess = {
  role: 'admin',
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
  profileId: 'owner-1',
  employeeId: null,
};

const employeeAccess: UserAccess = {
  role: 'employee',
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
  profileId: 'auth-e1',
  employeeId: 'e1',
};

describe('visibility filtering', () => {
  it('employee sees full staff and full schedule', () => {
    expect(filterVisibleEmployees(employees, employeeAccess)).toHaveLength(2);
    expect(filterVisibleShifts(shifts, employeeAccess)).toHaveLength(2);
  });

  it('employee sees only own payments', () => {
    expect(filterVisiblePayments(payments, employeeAccess).map((item) => item.id)).toEqual(['p1']);
  });
});

describe('payment permission logic', () => {
  it('admin can confirm and reject pending payments', () => {
    expect(canConfirmPayment(payments[0], adminAccess)).toBe(true);
    expect(canRejectPayment(payments[0], adminAccess)).toBe(true);
    expect(canConfirmPayment(payments[1], adminAccess)).toBe(false);
  });

  it('employee can edit/delete only own pending payments', () => {
    expect(canEditPayment(payments[0], employeeAccess)).toBe(true);
    expect(canDeletePayment(payments[0], employeeAccess)).toBe(true);
    expect(canEditPayment(payments[1], employeeAccess)).toBe(false);
    expect(canDeletePayment(payments[1], employeeAccess)).toBe(false);
  });
});
