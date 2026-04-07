import { describe, expect, it } from 'vitest';
import { normalizeInviteCode, validateInviteClaim } from './invite';

describe('invite claim logic', () => {
  it('normalizes invite code', () => {
    expect(normalizeInviteCode('  ab12cd34  ')).toBe('AB12CD34');
  });

  it('validates invite claim scenarios', () => {
    expect(validateInviteClaim({
      inviteCode: '',
      hasLinkedEmployee: false,
      targetEmployee: null,
    })).toEqual({ ok: false, code: 'invite_required' });

    expect(validateInviteClaim({
      inviteCode: 'AB12CD34',
      hasLinkedEmployee: true,
      targetEmployee: null,
    })).toEqual({ ok: false, code: 'already_linked' });

    expect(validateInviteClaim({
      inviteCode: 'AB12CD34',
      hasLinkedEmployee: false,
      targetEmployee: null,
    })).toEqual({ ok: false, code: 'invite_not_found' });

    expect(validateInviteClaim({
      inviteCode: 'AB12CD34',
      hasLinkedEmployee: false,
      targetEmployee: { archived: true, authUserId: null },
    })).toEqual({ ok: false, code: 'employee_archived' });

    expect(validateInviteClaim({
      inviteCode: 'AB12CD34',
      hasLinkedEmployee: false,
      targetEmployee: { archived: false, authUserId: 'auth-1' },
    })).toEqual({ ok: false, code: 'invite_already_used' });

    expect(validateInviteClaim({
      inviteCode: 'AB12CD34',
      hasLinkedEmployee: false,
      targetEmployee: { archived: false, authUserId: null },
    })).toEqual({ ok: true, code: 'ok' });
  });
});

