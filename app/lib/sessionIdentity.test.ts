import { beforeEach, describe, expect, it } from 'vitest';
import type { RecentAccount } from '../domain/types';
import { setCurrentLanguage } from './i18n';
import { buildInitials, buildSessionIdentity, mergeRecentAccounts } from './sessionIdentity';

describe('sessionIdentity helpers', () => {
  beforeEach(() => {
    setCurrentLanguage('ru');
  });

  it('builds normalized identity from auth metadata', () => {
    const identity = buildSessionIdentity({
      id: 'user-1',
      email: 'nikita@example.com',
      user_metadata: {
        name: 'Никита',
        picture: 'https://example.com/avatar.png',
        sub: 'auth-sub-1',
      },
      identities: [],
      app_metadata: {},
    } as never, {
      role: 'admin',
      isOwner: true,
    });

    expect(identity).not.toBeNull();
    expect(identity).toMatchObject({
      authUserId: 'user-1',
      email: 'nikita@example.com',
      displayName: 'Никита',
      avatarUrl: 'https://example.com/avatar.png',
      providerSubject: 'auth-sub-1',
      role: 'admin',
      roleLabel: 'Администратор',
      isOwner: true,
    });
  });

  it('switches role label with language', () => {
    setCurrentLanguage('en');

    const identity = buildSessionIdentity({
      id: 'user-2',
      email: 'hikari.taiou@gmail.com',
      user_metadata: {},
      identities: [],
      app_metadata: {},
    } as never, {
      role: 'employee',
      isOwner: false,
    });

    expect(identity?.roleLabel).toBe('Employee');
    expect(identity?.displayName).toBe('hikari.taiou');
  });

  it('builds initials from final display name', () => {
    expect(buildInitials('Павел Романов', 'hikari.taiou@gmail.com')).toBe('ПР');
    expect(buildInitials('', 'hikari.taiou@gmail.com')).toBe('HI');
  });

  it('keeps the most recent account first and limits cache size', () => {
    const baseAccounts: RecentAccount[] = Array.from({ length: 5 }).map((_, index) => ({
      authUserId: `user-${index}`,
      providerSubject: `sub-${index}`,
      email: `user-${index}@example.com`,
      displayName: `User ${index}`,
      avatarUrl: null,
      lastResolvedRole: index % 2 === 0 ? 'employee' : 'admin',
      lastSignedInAt: `2026-04-0${index + 1}T10:00:00.000Z`,
    }));

    const nextAccounts = mergeRecentAccounts(baseAccounts, {
      authUserId: 'user-99',
      providerSubject: 'sub-99',
      email: 'new@example.com',
      displayName: 'Новый пользователь',
      avatarUrl: null,
      initials: 'НП',
      role: 'employee',
      roleLabel: 'Сотрудник',
      isOwner: false,
    });

    expect(nextAccounts).toHaveLength(5);
    expect(nextAccounts[0]).toMatchObject({
      authUserId: 'user-99',
      email: 'new@example.com',
      lastResolvedRole: 'employee',
    });
    expect(nextAccounts.some((account) => account.authUserId === 'user-4')).toBe(false);
  });
});
