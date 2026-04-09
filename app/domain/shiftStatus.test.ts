import { describe, expect, it } from 'vitest';
import { normalizeShiftStatus } from './shiftStatus';

describe('shift status migration logic', () => {
  const now = new Date(2026, 3, 8, 12, 0, 0, 0);

  it('maps legacy working to shift', () => {
    expect(normalizeShiftStatus('working', '2026-04-07', now)).toBe('shift');
    expect(normalizeShiftStatus('working', '2026-04-20', now)).toBe('shift');
  });

  it('normalizes supported legacy statuses into canonical values', () => {
    expect(normalizeShiftStatus('worked', '2026-04-01', now)).toBe('shift');
    expect(normalizeShiftStatus('planned-work', '2026-04-09', now)).toBe('shift');
    expect(normalizeShiftStatus('day-off', '2026-04-09', now)).toBe('day_off');
    expect(normalizeShiftStatus('vacation', '2026-04-09', now)).toBe('day_off');
    expect(normalizeShiftStatus('sick', '2026-04-09', now)).toBe('sick_leave');
    expect(normalizeShiftStatus('no-show', '2026-04-09', now)).toBe('no_show');
    expect(normalizeShiftStatus('replacement', '2026-04-09', now)).toBe('replacement');
    expect(normalizeShiftStatus('no_shift', '2026-04-09', now)).toBe('no_shift');
  });

  it('returns null for client-only clear status', () => {
    expect(normalizeShiftStatus('none', '2026-04-09', now)).toBeNull();
  });
});
