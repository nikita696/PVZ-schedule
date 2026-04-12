import type { User } from '@supabase/supabase-js';
import type { RecentAccount, SessionIdentity, UserRole } from '../domain/types';
import { pickCurrentLanguage } from './i18n';

type MetadataRecord = Record<string, unknown>;

const asString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const buildInitials = (displayName: string, email: string | null): string => {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length > 0) {
    return words.map((word) => word[0]?.toUpperCase() ?? '').join('').slice(0, 2);
  }

  const localPart = email?.split('@')[0]?.trim() ?? '';
  if (localPart) {
    return localPart.slice(0, 2).toUpperCase();
  }

  return 'PV';
};

export const getRoleLabel = (role: UserRole | null): string | null => {
  if (role === 'admin') return pickCurrentLanguage('Администратор', 'Admin');
  if (role === 'employee') return pickCurrentLanguage('Сотрудник', 'Employee');
  return null;
};

export const buildSessionIdentity = (
  user: User | null,
  options?: Partial<Pick<SessionIdentity, 'role' | 'isOwner'>>,
): SessionIdentity | null => {
  if (!user) {
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as MetadataRecord;
  const firstIdentity = user.identities?.[0];
  const identityData = (firstIdentity?.identity_data ?? {}) as MetadataRecord;

  const email = firstString(
    user.email,
    metadata.email,
    metadata.default_email,
    identityData.email,
    identityData.default_email,
  );

  const fallbackUserName = pickCurrentLanguage('Пользователь', 'User');
  const displayName = firstString(
    metadata.name,
    metadata.full_name,
    metadata.display_name,
    metadata.nickname,
    identityData.real_name,
    identityData.display_name,
    identityData.login,
    email?.split('@')[0],
    fallbackUserName,
  ) ?? fallbackUserName;

  const avatarUrl = firstString(
    metadata.picture,
    metadata.avatar_url,
    identityData.picture,
    identityData.avatar_url,
  );

  const providerSubject = firstString(
    firstIdentity?.id,
    metadata.sub,
    metadata.id,
    identityData.sub,
    identityData.id,
  );

  const role = options?.role ?? null;

  return {
    authUserId: user.id,
    providerSubject,
    email,
    displayName,
    avatarUrl,
    initials: buildInitials(displayName, email),
    role,
    roleLabel: getRoleLabel(role),
    isOwner: options?.isOwner ?? role === 'admin',
  };
};

export const mergeRecentAccounts = (
  current: RecentAccount[],
  nextIdentity: SessionIdentity,
): RecentAccount[] => {
  const nextAccount: RecentAccount = {
    authUserId: nextIdentity.authUserId,
    providerSubject: nextIdentity.providerSubject,
    email: nextIdentity.email,
    displayName: nextIdentity.displayName,
    avatarUrl: nextIdentity.avatarUrl,
    lastResolvedRole: nextIdentity.role,
    lastSignedInAt: new Date().toISOString(),
  };

  const filtered = current.filter((account) => account.authUserId !== nextAccount.authUserId);
  return [nextAccount, ...filtered].slice(0, 5);
};
