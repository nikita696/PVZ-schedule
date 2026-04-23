import { expect, test, type Page, type Route } from '@playwright/test';

const SUPABASE_URL = 'https://nqwxeuewkimonifeckdr.supabase.co';
const SUPABASE_STORAGE_KEY = 'sb-nqwxeuewkimonifeckdr-auth-token';
const LANGUAGE_STORAGE_KEY = 'pvz-schedule.language';
const PREFERENCES_STORAGE_KEY = 'pvz-schedule-ui-v1';

type FixtureRole = 'admin' | 'employee';

interface FixtureData {
  session: Record<string, unknown>;
  profile: Record<string, unknown>;
  organization: Record<string, unknown>;
  employees: Record<string, unknown>[];
  shifts: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  rateHistory: Record<string, unknown>[];
  scheduleMonths: Record<string, unknown>[];
}

const jsonHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
  'content-type': 'application/json',
};

const encodeBase64Url = (value: string): string => (
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

const createFakeJwt = (subject: string, exp: number): string => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({ sub: subject, exp, role: 'authenticated' }));
  return `${header}.${payload}.signature`;
};

const buildFixtureData = (role: FixtureRole): FixtureData => {
  const authUserId = role === 'admin' ? 'user-admin' : 'user-employee';
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = createFakeJwt(authUserId, expiresAt);
  const baseNow = '2026-04-22T08:00:00.000Z';

  const employees = [
    {
      id: 'emp-owner',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: 'user-admin',
      auth_user_id: 'user-admin',
      work_email: 'nik@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: true,
      hired_at: '2026-01-01',
      terminated_at: null,
      name: 'Никита Власов',
      daily_rate: 5000,
      archived: false,
      archived_at: null,
      created_at: '2026-01-01T08:00:00.000Z',
      updated_at: baseNow,
    },
    {
      id: 'emp-pavel',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: 'user-employee',
      auth_user_id: 'user-employee',
      work_email: 'pavel@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: false,
      hired_at: '2026-01-01',
      terminated_at: null,
      name: 'Павел Смирнов',
      daily_rate: 4300,
      archived: false,
      archived_at: null,
      created_at: '2026-01-02T08:00:00.000Z',
      updated_at: baseNow,
    },
    {
      id: 'emp-alina',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: null,
      auth_user_id: null,
      work_email: 'alina@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: false,
      hired_at: '2026-01-05',
      terminated_at: null,
      name: 'Алина Воробьева',
      daily_rate: 4100,
      archived: false,
      archived_at: null,
      created_at: '2026-01-05T08:00:00.000Z',
      updated_at: baseNow,
    },
  ];

  return {
    session: {
      access_token: accessToken,
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 60 * 60,
      expires_at: expiresAt,
      user: {
        id: authUserId,
        aud: 'authenticated',
        role: 'authenticated',
        email: role === 'admin' ? 'nik@example.com' : 'pavel@example.com',
        email_confirmed_at: '2026-04-01T00:00:00.000Z',
        phone: '',
        confirmed_at: '2026-04-01T00:00:00.000Z',
        last_sign_in_at: baseNow,
        app_metadata: {
          provider: 'email',
          providers: ['email'],
        },
        user_metadata: {
          name: role === 'admin' ? 'Никита Власов' : 'Павел Смирнов',
          sub: `sub-${authUserId}`,
        },
        identities: [],
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: baseNow,
      },
    },
    profile: {
      id: authUserId,
      organization_id: 'org-1',
      role,
      display_name: role === 'admin' ? 'Никита Власов' : 'Павел Смирнов',
      is_active: true,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: baseNow,
    },
    organization: {
      id: 'org-1',
      created_by: 'user-admin',
      name: 'PVZ',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: baseNow,
    },
    employees,
    shifts: [
      {
        id: 'shift-1',
        user_id: 'user-admin',
        organization_id: 'org-1',
        employee_id: 'emp-owner',
        work_date: '2026-05-01',
        status: 'shift',
        requested_status: 'shift',
        approved_status: 'shift',
        actual_status: null,
        rate_snapshot: 5000,
        created_by_profile_id: 'user-admin',
        requested_by_profile_id: 'user-admin',
        approved_by_profile_id: 'user-admin',
        actual_by_profile_id: null,
        created_at: baseNow,
        updated_at: baseNow,
      },
      {
        id: 'shift-2',
        user_id: 'user-admin',
        organization_id: 'org-1',
        employee_id: 'emp-pavel',
        work_date: '2026-05-01',
        status: 'day_off',
        requested_status: 'day_off',
        approved_status: 'day_off',
        actual_status: null,
        rate_snapshot: 4300,
        created_by_profile_id: 'user-admin',
        requested_by_profile_id: 'user-admin',
        approved_by_profile_id: 'user-admin',
        actual_by_profile_id: null,
        created_at: baseNow,
        updated_at: baseNow,
      },
      {
        id: 'shift-3',
        user_id: 'user-admin',
        organization_id: 'org-1',
        employee_id: 'emp-alina',
        work_date: '2026-05-01',
        status: 'no_shift',
        requested_status: 'no_shift',
        approved_status: 'no_shift',
        actual_status: null,
        rate_snapshot: 4100,
        created_by_profile_id: 'user-admin',
        requested_by_profile_id: 'user-admin',
        approved_by_profile_id: 'user-admin',
        actual_by_profile_id: null,
        created_at: baseNow,
        updated_at: baseNow,
      },
      {
        id: 'shift-4',
        user_id: 'user-admin',
        organization_id: 'org-1',
        employee_id: 'emp-pavel',
        work_date: '2026-05-02',
        status: 'shift',
        requested_status: 'shift',
        approved_status: 'shift',
        actual_status: null,
        rate_snapshot: 4300,
        created_by_profile_id: 'user-admin',
        requested_by_profile_id: 'user-admin',
        approved_by_profile_id: 'user-admin',
        actual_by_profile_id: null,
        created_at: baseNow,
        updated_at: baseNow,
      },
      {
        id: 'shift-5',
        user_id: 'user-admin',
        organization_id: 'org-1',
        employee_id: 'emp-owner',
        work_date: '2026-05-04',
        status: 'replacement',
        requested_status: 'replacement',
        approved_status: 'replacement',
        actual_status: null,
        rate_snapshot: 5000,
        created_by_profile_id: 'user-admin',
        requested_by_profile_id: 'user-admin',
        approved_by_profile_id: 'user-admin',
        actual_by_profile_id: null,
        created_at: baseNow,
        updated_at: baseNow,
      },
    ],
    payments: [],
    rateHistory: employees.map((employee) => ({
      id: `rate-${employee.id}`,
      employee_id: employee.id,
      organization_id: 'org-1',
      rate: employee.daily_rate,
      valid_from: employee.hired_at,
      valid_to: null,
      created_by_profile_id: 'user-admin',
      created_at: '2026-01-01T00:00:00.000Z',
    })),
    scheduleMonths: [
      {
        id: 'month-2026-05',
        organization_id: 'org-1',
        year: 2026,
        month: 5,
        status: 'draft',
        approved_by_profile_id: null,
        approved_at: null,
        closed_by_profile_id: null,
        closed_at: null,
        created_at: '2026-05-01T00:00:00.000Z',
        updated_at: baseNow,
      },
    ],
  };
};

const fulfillJson = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
};

const mockSupabase = async (page: Page, fixture: FixtureData) => {
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: jsonHeaders, body: '' });
      return;
    }

    switch (url.pathname) {
      case '/rest/v1/rpc/ensure_profile_membership':
        await fulfillJson(route, null);
        return;
      case '/rest/v1/profiles':
        await fulfillJson(route, fixture.profile);
        return;
      case '/rest/v1/organizations':
        await fulfillJson(route, fixture.organization);
        return;
      case '/rest/v1/employees':
        await fulfillJson(route, fixture.employees);
        return;
      case '/rest/v1/shifts':
        await fulfillJson(route, fixture.shifts);
        return;
      case '/rest/v1/payments':
        await fulfillJson(route, fixture.payments);
        return;
      case '/rest/v1/employee_rate_history':
        await fulfillJson(route, fixture.rateHistory);
        return;
      case '/rest/v1/schedule_months':
        await fulfillJson(route, fixture.scheduleMonths);
        return;
      default:
        throw new Error(`Unhandled Supabase request: ${request.method()} ${url.pathname}${url.search}`);
    }
  });
};

const bootstrapCalendar = async (page: Page, role: FixtureRole) => {
  const fixture = buildFixtureData(role);

  await mockSupabase(page, fixture);
  await page.addInitScript(
    ({ session, storageKey, languageStorageKey, preferencesStorageKey }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(languageStorageKey, 'ru');
      window.localStorage.setItem(preferencesStorageKey, JSON.stringify({
        selectedMonth: 5,
        selectedYear: 2026,
      }));
    },
    {
      session: fixture.session,
      storageKey: SUPABASE_STORAGE_KEY,
      languageStorageKey: LANGUAGE_STORAGE_KEY,
      preferencesStorageKey: PREFERENCES_STORAGE_KEY,
    },
  );
};

test.describe('calendar routes and density', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('admin calendar rolls back to the legacy classic view', async ({ page }) => {
    await bootstrapCalendar(page, 'admin');
    await page.goto('/admin/calendar');

    await expect(page.getByTestId('legacy-calendar-shell')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/calendar$/);
    await expect(page.locator('[data-testid="experimental-calendar-shell"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Open experimental calendar|Открыть experimental calendar/i })).toHaveCount(0);
    await expect(page.getByText(/employees in the schedule|сотрудников в графике/i)).toBeVisible();
    await expect(page.getByText(/Никита Власов/i).first()).toBeVisible();
  });

  test('employee calendar stays compact and editable for personal schedule', async ({ page }) => {
    await bootstrapCalendar(page, 'employee');
    await page.goto('/employee/calendar');

    await expect(page.getByTestId('experimental-calendar-shell')).toBeVisible();
    await expect(page).toHaveURL(/\/employee\/calendar$/);

    const noVerticalScroll = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollHeight <= window.innerHeight;
    });
    expect(noVerticalScroll).toBe(true);

    const mayFirstCard = page.locator('[data-day="2026-05-01"]');
    await expect(mayFirstCard).toContainText('Павел Смирнов');
    await expect(mayFirstCard).not.toContainText(/ещё 1|1 more/i);

    await mayFirstCard.getByRole('button', { name: /Павел Смирнов/i }).click();
    await expect(page.getByTestId('calendar-assignment-editor')).toBeVisible();
  });
});
