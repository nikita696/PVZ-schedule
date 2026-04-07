import { describe, expect, it } from 'vitest';
import { normalizeShiftStatus } from './shiftStatus';

describe('shift status migration logic', () => {
  const now = new Date(2026, 3, 8, 12, 0, 0, 0); // 2026-04-08

  it('maps legacy working to worked for past dates', () => {
    expect(normalizeShiftStatus('working', '2026-04-07', now)).toBe('worked');
  });

  it('maps legacy working to planned-work for current/future dates', () => {
    expect(normalizeShiftStatus('working', '2026-04-08', now)).toBe('planned-work');
    expect(normalizeShiftStatus('working', '2026-04-20', now)).toBe('planned-work');
  });

  it('keeps supported statuses unchanged', () => {
    expect(normalizeShiftStatus('worked', '2026-04-01', now)).toBe('worked');
    expect(normalizeShiftStatus('planned-work', '2026-04-09', now)).toBe('planned-work');
    expect(normalizeShiftStatus('day-off', '2026-04-09', now)).toBe('day-off');
    expect(normalizeShiftStatus('vacation', '2026-04-09', now)).toBe('vacation');
    expect(normalizeShiftStatus('sick', '2026-04-09', now)).toBe('sick');
    expect(normalizeShiftStatus('no-show', '2026-04-09', now)).toBe('no-show');
  });

  it('returns null for client-only none status', () => {
    expect(normalizeShiftStatus('none', '2026-04-09', now)).toBeNull();
  });
});

