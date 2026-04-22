import { describe, expect, it } from 'vitest';
import type {
  Employee,
  EmployeeRateHistory,
  Payment,
  ScheduleMonth,
  Shift,
  UserAccess,
} from '../domain/types';
import {
  createEmptyAppDataState,
  normalizeAppDataState,
  withCurrentUserNameUpdated,
  withEmployeeAdded,
  withEmployeeRateUpdated,
  withScheduleMonthUpdated,
  withShiftUpserted,
  withoutEmployee,
} from './appState';

const baseEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'employee-1',
  userId: 'user-1',
  organizationId: 'org-1',
  profileId: null,
  authUserId: null,
  workEmail: 'employee@example.com',
  status: 'active',
  createdByProfileId: 'profile-1',
  isOwner: false,
  hiredAt: '2026-04-01',
  terminatedAt: null,
  name: 'Ирина',
  dailyRate: 5000,
  archived: false,
  archivedAt: null,
  createdAt: '2026-04-01T09:00:00.000Z',
  updatedAt: '2026-04-01T09:00:00.000Z',
  ...overrides,
});

const baseRateHistory = (overrides: Partial<EmployeeRateHistory> = {}): EmployeeRateHistory => ({
  id: 'rate-1',
  employeeId: 'employee-1',
  organizationId: 'org-1',
  rate: 5000,
  validFrom: '2026-04-01',
  validTo: null,
  createdByProfileId: 'profile-1',
  createdAt: '2026-04-01T09:00:00.000Z',
  ...overrides,
});

const baseScheduleMonth = (overrides: Partial<ScheduleMonth> = {}): ScheduleMonth => ({
  id: 'month-1',
  organizationId: 'org-1',
  year: 2026,
  month: 4,
  status: 'draft',
  approvedByProfileId: null,
  approvedAt: null,
  closedByProfileId: null,
  closedAt: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const baseShift = (overrides: Partial<Shift> = {}): Shift => ({
  id: 'shift-1',
  userId: 'user-1',
  organizationId: 'org-1',
  employeeId: 'employee-1',
  date: '2026-04-10',
  status: 'shift',
  requestedStatus: 'shift',
  approvedStatus: 'shift',
  actualStatus: null,
  rateSnapshot: 5000,
  createdByProfileId: 'profile-1',
  requestedByProfileId: 'profile-1',
  approvedByProfileId: null,
  actualByProfileId: null,
  createdAt: '2026-04-10T09:00:00.000Z',
  updatedAt: '2026-04-10T09:00:00.000Z',
  ...overrides,
});

const basePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  userId: 'user-1',
  organizationId: 'org-1',
  employeeId: 'employee-1',
  amount: 5000,
  date: '2026-04-11',
  comment: '',
  status: 'approved',
  requestedByAuthUserId: 'user-1',
  approvedByAuthUserId: 'user-1',
  requestedByProfileId: 'profile-1',
  approvedByProfileId: 'profile-1',
  approvedAt: '2026-04-11T09:00:00.000Z',
  editedByAdmin: false,
  createdAt: '2026-04-11T09:00:00.000Z',
  updatedAt: '2026-04-11T09:00:00.000Z',
  ...overrides,
});

const baseAccess = (overrides: Partial<UserAccess> = {}): UserAccess => ({
  role: 'employee',
  organizationId: 'org-1',
  ownerUserId: 'owner-1',
  profileId: 'profile-1',
  profileDisplayName: 'Ирина',
  employeeId: 'employee-1',
  ...overrides,
});

describe('appState helpers', () => {
  it('normalizes server data ordering without touching access', () => {
    const nextState = normalizeAppDataState({
      employees: [
        baseEmployee({ id: 'employee-2', name: 'Яна', archived: true, status: 'archived' }),
        baseEmployee({ id: 'employee-1', name: 'Алина' }),
      ],
      rateHistory: [
        baseRateHistory({ id: 'rate-2', employeeId: 'employee-2', validFrom: '2026-04-03' }),
        baseRateHistory({ id: 'rate-1', employeeId: 'employee-1', validFrom: '2026-04-02' }),
      ],
      scheduleMonths: [
        baseScheduleMonth({ id: 'month-2', year: 2026, month: 5 }),
        baseScheduleMonth({ id: 'month-1', year: 2026, month: 4 }),
      ],
      shifts: [
        baseShift({ id: 'shift-2', date: '2026-04-12' }),
        baseShift({ id: 'shift-1', date: '2026-04-10' }),
      ],
      payments: [
        basePayment({ id: 'payment-1', date: '2026-04-09', createdAt: '2026-04-09T09:00:00.000Z' }),
        basePayment({ id: 'payment-2', date: '2026-04-11', createdAt: '2026-04-11T09:00:00.000Z' }),
      ],
      access: baseAccess(),
    });

    expect(nextState.employees.map((item) => item.id)).toEqual(['employee-1', 'employee-2']);
    expect(nextState.rateHistory.map((item) => item.id)).toEqual(['rate-1', 'rate-2']);
    expect(nextState.scheduleMonths.map((item) => item.id)).toEqual(['month-1', 'month-2']);
    expect(nextState.shifts.map((item) => item.id)).toEqual(['shift-1', 'shift-2']);
    expect(nextState.payments.map((item) => item.id)).toEqual(['payment-2', 'payment-1']);
    expect(nextState.access?.profileDisplayName).toBe('Ирина');
  });

  it('updates current user display name in both access and linked employee cache', () => {
    const nextState = withCurrentUserNameUpdated({
      ...createEmptyAppDataState(),
      employees: [baseEmployee()],
      access: baseAccess(),
    }, 'Ирина Новая', baseEmployee({ name: 'Ирина Новая' }));

    expect(nextState.access?.profileDisplayName).toBe('Ирина Новая');
    expect(nextState.employees[0]?.name).toBe('Ирина Новая');
  });

  it('adds local rate history entries for new employees and closes previous rate on rate update', () => {
    const addedState = withEmployeeAdded(createEmptyAppDataState(), baseEmployee(), 'profile-1');

    expect(addedState.rateHistory).toHaveLength(1);
    expect(addedState.rateHistory[0]).toMatchObject({
      employeeId: 'employee-1',
      validFrom: '2026-04-01',
      rate: 5000,
    });

    const updatedState = withEmployeeRateUpdated({
      ...addedState,
      rateHistory: [
        baseRateHistory({ id: 'rate-1', validFrom: '2026-04-01', validTo: null }),
      ],
    }, baseEmployee({ dailyRate: 6500 }), '2026-04-15', 'profile-1', '2026-04-15T08:00:00.000Z');

    expect(updatedState.rateHistory).toHaveLength(2);
    expect(updatedState.rateHistory[0]).toMatchObject({
      id: 'rate-1',
      validTo: '2026-04-15',
    });
    expect(updatedState.rateHistory[1]).toMatchObject({
      id: 'local-rate:employee-1:2026-04-15',
      rate: 6500,
      validFrom: '2026-04-15',
      validTo: null,
    });
  });

  it('upserts schedule months and shifts by business keys instead of duplicating them', () => {
    const scheduleState = withScheduleMonthUpdated({
      ...createEmptyAppDataState(),
      scheduleMonths: [baseScheduleMonth({ id: 'month-1', status: 'draft' })],
    }, baseScheduleMonth({ id: 'month-2', status: 'approved' }));

    expect(scheduleState.scheduleMonths).toHaveLength(1);
    expect(scheduleState.scheduleMonths[0]).toMatchObject({
      id: 'month-2',
      status: 'approved',
    });

    const shiftState = withShiftUpserted({
      ...createEmptyAppDataState(),
      shifts: [baseShift({ id: 'shift-1', status: 'shift' })],
    }, baseShift({ id: 'shift-2', status: 'day_off' }));

    expect(shiftState.shifts).toHaveLength(1);
    expect(shiftState.shifts[0]).toMatchObject({
      id: 'shift-2',
      status: 'day_off',
    });
  });

  it('removes archived employee dependencies from local cache in one pass', () => {
    const nextState = withoutEmployee({
      ...createEmptyAppDataState(),
      employees: [baseEmployee()],
      rateHistory: [baseRateHistory()],
      shifts: [baseShift()],
      payments: [basePayment()],
      access: baseAccess(),
    }, 'employee-1');

    expect(nextState.employees).toHaveLength(0);
    expect(nextState.rateHistory).toHaveLength(0);
    expect(nextState.shifts).toHaveLength(0);
    expect(nextState.payments).toHaveLength(0);
    expect(nextState.access?.employeeId).toBe('employee-1');
  });
});
