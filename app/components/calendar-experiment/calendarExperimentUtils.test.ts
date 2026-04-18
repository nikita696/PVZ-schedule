import { describe, expect, it } from 'vitest';
import type { Employee, Shift } from '../../domain/types';
import {
  buildCalendarGridDays,
  buildShiftLookup,
  getDayIssues,
  isoDate,
} from './calendarExperimentUtils';

const employee = (id: string, name: string): Employee => ({
  id,
  userId: `user-${id}`,
  organizationId: 'org-1',
  profileId: null,
  authUserId: null,
  workEmail: null,
  status: 'active',
  createdByProfileId: null,
  isOwner: false,
  hiredAt: '2026-04-01',
  terminatedAt: null,
  name,
  dailyRate: 2500,
  archived: false,
  archivedAt: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
});

const shift = (employeeId: string, date: string, status: Shift['status']): Shift => ({
  id: `${employeeId}:${date}`,
  userId: `user-${employeeId}`,
  organizationId: 'org-1',
  employeeId,
  date,
  status,
  requestedStatus: null,
  approvedStatus: null,
  actualStatus: null,
  rateSnapshot: 2500,
  createdByProfileId: null,
  requestedByProfileId: null,
  approvedByProfileId: null,
  actualByProfileId: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
});

describe('calendarExperimentUtils', () => {
  it('builds a full 6-week month grid with current-month markers', () => {
    const days = buildCalendarGridDays(
      2026,
      4,
      [employee('emp-1', 'Ник')],
      buildShiftLookup([]),
      'ru',
      new Date('2026-04-18T10:00:00.000Z'),
    );

    expect(days).toHaveLength(42);
    expect(days.filter((day) => day.isCurrentMonth)).toHaveLength(30);
    expect(days.some((day) => day.isToday && day.date === '2026-04-18')).toBe(true);
    expect(days[0]?.weekday).toBe(0);
  });

  it('flags uncovered, conflict, and no-show days separately', () => {
    const employees = [employee('emp-1', 'Ник'), employee('emp-2', 'Павел')];
    const day = isoDate(2026, 4, 18);

    expect(getDayIssues(day, employees, buildShiftLookup([]), 'ru')).toMatchObject({
      coverage: true,
      conflict: false,
      noShow: false,
      tone: 'danger',
    });

    expect(getDayIssues(day, employees, buildShiftLookup([
      shift('emp-1', day, 'shift'),
      shift('emp-2', day, 'replacement'),
    ]), 'ru')).toMatchObject({
      coverage: false,
      conflict: true,
      tone: 'warning',
    });

    expect(getDayIssues(day, employees, buildShiftLookup([
      shift('emp-1', day, 'no_show'),
    ]), 'ru')).toMatchObject({
      coverage: true,
      conflict: false,
      noShow: true,
      total: 2,
    });
  });
});
