import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentLanguage } from './i18n';
import {
  buildAuthRedirectTo,
  buildYandexAuthQueryParams,
  getIncompleteYandexAuthMessage,
  getYandexAuthSuccessMessage,
  isPendingAuthFlowFresh,
  readPendingYandexRoleFromUrl,
  stripPendingYandexRoleFromUrl,
} from './yandexAuth';

describe('yandex auth helpers', () => {
  beforeEach(() => {
    setCurrentLanguage('ru');
  });

  it('builds force_confirm query params only for forced chooser', () => {
    expect(buildYandexAuthQueryParams(false)).toBeUndefined();
    expect(buildYandexAuthQueryParams(true)).toEqual({ force_confirm: 'yes' });
  });

  it('persists the selected role inside the auth redirect url', () => {
    expect(buildAuthRedirectTo('https://pvz-schedule.vercel.app', 'employee'))
      .toBe('https://pvz-schedule.vercel.app/auth/login?oauthRole=employee');
    expect(buildAuthRedirectTo('https://pvz-schedule.vercel.app/', 'admin'))
      .toBe('https://pvz-schedule.vercel.app/auth/login?oauthRole=admin');
    expect(buildAuthRedirectTo('https://pvz-schedule.vercel.app'))
      .toBe('https://pvz-schedule.vercel.app/auth/login');
  });

  it('reads and strips oauth role hints from callback urls', () => {
    expect(readPendingYandexRoleFromUrl('https://pvz-schedule.vercel.app/auth/login?oauthRole=employee&code=123'))
      .toBe('employee');
    expect(readPendingYandexRoleFromUrl('https://pvz-schedule.vercel.app/auth/login?oauthRole=admin'))
      .toBe('admin');
    expect(readPendingYandexRoleFromUrl('https://pvz-schedule.vercel.app/auth/login'))
      .toBeNull();
    expect(stripPendingYandexRoleFromUrl('https://pvz-schedule.vercel.app/auth/login?oauthRole=employee&code=123'))
      .toBe('https://pvz-schedule.vercel.app/auth/login?code=123');
  });

  it('returns correct UX messages for login and switch-account flows', () => {
    expect(getYandexAuthSuccessMessage(false)).toBe('Открываю вход через Яндекс ID...');
    expect(getYandexAuthSuccessMessage(true)).toBe('Открываю Яндекс ID с выбором аккаунта...');
    expect(getIncompleteYandexAuthMessage('login')).toContain('Вход через Яндекс');
    expect(getIncompleteYandexAuthMessage('switch-account')).toContain('Смена аккаунта');
  });

  it('returns english messages when language is switched', () => {
    setCurrentLanguage('en');

    expect(getYandexAuthSuccessMessage(false)).toBe('Opening Yandex ID sign-in...');
    expect(getYandexAuthSuccessMessage(true)).toBe('Opening Yandex ID account chooser...');
    expect(getIncompleteYandexAuthMessage('login')).toContain('Yandex sign-in');
    expect(getIncompleteYandexAuthMessage('switch-account')).toContain('Account switching');
  });

  it('treats only recent pending auth flows as fresh', () => {
    const now = Date.parse('2026-04-11T12:00:00.000Z');
    expect(isPendingAuthFlowFresh('2026-04-11T11:55:00.000Z', now)).toBe(true);
    expect(isPendingAuthFlowFresh('2026-04-11T11:30:00.000Z', now)).toBe(false);
    expect(isPendingAuthFlowFresh('not-a-date', now)).toBe(false);
  });
});
