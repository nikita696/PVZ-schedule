import { describe, expect, it } from 'vitest';
import {
  canConfirmPayment,
  canDeletePayment,
  canEditPayment,
  filterVisibleEmployees,
  filterVisiblePayments,
  filterVisibleShifts,
} from './access';
import type { Employee, Payment, Shift, UserAccess } from './types';

const employees: Employee[] = [
  {
    id: 'e1',
    userId: 'owner-1',
    authUserId: 'auth-e1',
    isOwner: false,
    hiredAt: null,
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
    authUserId: 'auth-e2',
    isOwner: false,
    hiredAt: null,
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
    employeeId: 'e1',
    date: '2026-04-10',
    status: 'worked',
    rateSnapshot: 2500,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  {
    id: 's2',
    userId: 'owner-1',
    employeeId: 'e2',
    date: '2026-04-10',
    status: 'planned-work',
    rateSnapshot: 2500,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
];

const payments: Payment[] = [
  {
    id: 'p1',
    userId: 'owner-1',
    employeeId: 'e1',
    amount: 1000,
    date: '2026-04-11',
    comment: 'cash',
    status: 'entered',
    createdByAuthUserId: 'auth-e1',
    confirmedByAuthUserId: null,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    id: 'p2',
    userId: 'owner-1',
    employeeId: 'e2',
    amount: 1500,
    date: '2026-04-11',
    comment: 'bank',
    status: 'confirmed',
    createdByAuthUserId: 'owner-1',
    confirmedByAuthUserId: 'owner-1',
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
];

const ownerAccess: UserAccess = { role: 'owner', ownerUserId: 'owner-1', employeeId: null };
const employeeAccess: UserAccess = { role: 'employee', ownerUserId: 'owner-1', employeeId: 'e1' };

describe('visibility filtering', () => {
  it('owner sees all entities', () => {
    expect(filterVisibleEmployees(employees, ownerAccess)).toHaveLength(2);
    expect(filterVisibleShifts(shifts, ownerAccess)).toHaveLength(2);
    expect(filterVisiblePayments(payments, ownerAccess)).toHaveLength(2);
  });

  it('employee sees only own entities', () => {
    expect(filterVisibleEmployees(employees, employeeAccess).map((item) => item.id)).toEqual(['e1']);
    expect(filterVisibleShifts(shifts, employeeAccess).map((item) => item.id)).toEqual(['s1']);
    expect(filterVisiblePayments(payments, employeeAccess).map((item) => item.id)).toEqual(['p1']);
  });
});

describe('payment permission logic', () => {
  it('owner can confirm entered payments', () => {
    expect(canConfirmPayment(payments[0], ownerAccess)).toBe(true);
    expect(canConfirmPayment(payments[1], ownerAccess)).toBe(false);
  });

  it('employee can edit/delete only own entered payments', () => {
    expect(canEditPayment(payments[0], employeeAccess)).toBe(true);
    expect(canDeletePayment(payments[0], employeeAccess)).toBe(true);
    expect(canEditPayment(payments[1], employeeAccess)).toBe(false);
    expect(canDeletePayment(payments[1], employeeAccess)).toBe(false);
  });
});
