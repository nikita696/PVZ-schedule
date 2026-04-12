import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentLanguage } from './i18n';
import {
  buildYandexAuthQueryParams,
  getIncompleteYandexAuthMessage,
  getYandexAuthSuccessMessage,
  isPendingAuthFlowFresh,
} from './yandexAuth';

describe('yandex auth helpers', () => {
  beforeEach(() => {
    setCurrentLanguage('ru');
  });

  it('builds force_confirm query params only for forced chooser', () => {
    expect(buildYandexAuthQueryParams(false)).toBeUndefined();
    expect(buildYandexAuthQueryParams(true)).toEqual({ force_confirm: 'yes' });
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
