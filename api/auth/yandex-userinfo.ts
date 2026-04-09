const YANDEX_USERINFO_URL = 'https://login.yandex.ru/info?format=json';

type HeaderValue = string | string[] | undefined;

interface VercelLikeRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

interface YandexUserInfo {
  id?: string | number;
  default_email?: string;
  emails?: string[];
  login?: string;
  display_name?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  sex?: string;
  default_avatar_id?: string | null;
}

const readHeaderValue = (value: HeaderValue): string => {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return typeof value === 'string' ? value.trim() : '';
};

const firstNonEmpty = (...values: Array<string | null | undefined>): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const normalizeAuthorizationHeader = (value: string): string => {
  const token = value
    .replace(/^bearer\s+/i, '')
    .replace(/^oauth\s+/i, '')
    .trim();

  return token ? `OAuth ${token}` : '';
};

const buildAvatarUrl = (avatarId: string | null | undefined): string | undefined => {
  if (!avatarId) {
    return undefined;
  }

  return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
};

const writeJson = (response: VercelLikeResponse, status: number, body: unknown) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json(body);
};

export default async function handler(request: VercelLikeRequest, response: VercelLikeResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    writeJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const incomingAuthorization = readHeaderValue(request.headers.authorization);
  const authorization = normalizeAuthorizationHeader(incomingAuthorization);

  if (!authorization) {
    writeJson(response, 401, { error: 'AUTHORIZATION_REQUIRED' });
    return;
  }

  try {
    const yandexResponse = await fetch(YANDEX_USERINFO_URL, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
    });

    const rawBody = await yandexResponse.text();

    if (!yandexResponse.ok) {
      writeJson(response, yandexResponse.status, {
        error: 'YANDEX_USERINFO_FAILED',
        details: rawBody.slice(0, 500),
      });
      return;
    }

    const payload = JSON.parse(rawBody) as YandexUserInfo;
    const email = firstNonEmpty(payload.default_email, ...(payload.emails ?? []));
    const givenName = firstNonEmpty(payload.first_name);
    const familyName = firstNonEmpty(payload.last_name);
    const fallbackFullName = `${givenName} ${familyName}`.trim();
    const fullName = firstNonEmpty(payload.real_name, payload.display_name, fallbackFullName, payload.login);

    writeJson(response, 200, {
      sub: payload.id != null ? String(payload.id) : '',
      email,
      email_verified: Boolean(email),
      name: fullName,
      preferred_username: firstNonEmpty(payload.login),
      nickname: firstNonEmpty(payload.display_name, payload.login),
      given_name: givenName,
      family_name: familyName,
      gender: firstNonEmpty(payload.sex) || undefined,
      picture: buildAvatarUrl(payload.default_avatar_id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    writeJson(response, 500, {
      error: 'YANDEX_USERINFO_PROXY_ERROR',
      details: message,
    });
  }
}
