interface InviteTarget {
  archived: boolean;
  authUserId: string | null;
}

export type InviteClaimValidationCode =
  | 'ok'
  | 'invite_required'
  | 'already_linked'
  | 'invite_not_found'
  | 'employee_archived'
  | 'invite_already_used';

export interface InviteClaimValidationResult {
  ok: boolean;
  code: InviteClaimValidationCode;
}

export const normalizeInviteCode = (value: string): string => value.trim().toUpperCase();

export const validateInviteClaim = (params: {
  inviteCode: string;
  hasLinkedEmployee: boolean;
  targetEmployee: InviteTarget | null;
}): InviteClaimValidationResult => {
  const code = normalizeInviteCode(params.inviteCode);
  if (!code) return { ok: false, code: 'invite_required' };
  if (params.hasLinkedEmployee) return { ok: false, code: 'already_linked' };
  if (!params.targetEmployee) return { ok: false, code: 'invite_not_found' };
  if (params.targetEmployee.archived) return { ok: false, code: 'employee_archived' };
  if (params.targetEmployee.authUserId) return { ok: false, code: 'invite_already_used' };
  return { ok: true, code: 'ok' };
};

