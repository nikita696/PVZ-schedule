import { pickCurrentLanguage } from './i18n';

export type PendingAuthFlowMode = 'login' | 'switch-account';
export type PendingYandexRegistrationRole = 'admin' | 'employee';

const PENDING_AUTH_FLOW_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_ROLE_QUERY_PARAM = 'oauthRole';

export const buildYandexAuthQueryParams = (forceAccountSelection: boolean): Record<string, string> | undefined => (
  forceAccountSelection ? { force_confirm: 'yes' } : undefined
);

export const buildAuthRedirectTo = (appUrl: string, role?: PendingYandexRegistrationRole): string => {
  const url = new URL(`${appUrl.replace(/\/+$/, '')}/auth/login`);
  if (role) {
    url.searchParams.set(OAUTH_ROLE_QUERY_PARAM, role);
  }

  return url.toString();
};

export const readPendingYandexRoleFromUrl = (href: string): PendingYandexRegistrationRole | null => {
  try {
    const url = new URL(href);
    const role = url.searchParams.get(OAUTH_ROLE_QUERY_PARAM);
    return role === 'admin' || role === 'employee' ? role : null;
  } catch {
    return null;
  }
};

export const stripPendingYandexRoleFromUrl = (href: string): string => {
  try {
    const url = new URL(href);
    url.searchParams.delete(OAUTH_ROLE_QUERY_PARAM);
    return url.toString();
  } catch {
    return href;
  }
};

export const getYandexAuthSuccessMessage = (forceAccountSelection: boolean): string => (
  forceAccountSelection
    ? pickCurrentLanguage('Открываю Яндекс ID с выбором аккаунта...', 'Opening Yandex ID account chooser...')
    : pickCurrentLanguage('Открываю вход через Яндекс ID...', 'Opening Yandex ID sign-in...')
);

export const getIncompleteYandexAuthMessage = (mode: PendingAuthFlowMode): string => (
  mode === 'switch-account'
    ? pickCurrentLanguage(
      'Смена аккаунта не завершилась. Попробуй ещё раз через кнопку смены аккаунта.',
      'Account switching did not finish. Try the switch account button again.',
    )
    : pickCurrentLanguage(
      'Вход через Яндекс не завершился. Попробуй ещё раз.',
      'Yandex sign-in did not finish. Please try again.',
    )
);

export const isPendingAuthFlowFresh = (startedAt: string, now = Date.now()): boolean => {
  const timestamp = Date.parse(startedAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return now - timestamp <= PENDING_AUTH_FLOW_MAX_AGE_MS;
};
