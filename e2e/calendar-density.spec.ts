import { expect, test, type Page, type Route } from '@playwright/test';

const SUPABASE_URL = 'https://nqwxeuewkimonifeckdr.supabase.co';
const SUPABASE_STORAGE_KEY = 'sb-nqwxeuewkimonifeckdr-auth-token';
const LANGUAGE_STORAGE_KEY = 'pvz-schedule.language';
const PREFERENCES_STORAGE_KEY = 'pvz-schedule-ui-v1';

type FixtureRole = 'admin' | 'employee';
type ShiftStatusFixture = 'shift' | 'day_off' | 'sick_leave' | 'no_show' | 'replacement' | 'no_shift';

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

interface RpcCalls {
  upserts: Array<{ employeeId: string; date: string; status: ShiftStatusFixture }>;
  deletes: Array<{ employeeId: string; date: string }>;
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

const createShift = (
  id: string,
  employeeId: string,
  workDate: string,
  status: ShiftStatusFixture,
  rateSnapshot: number,
) => ({
  id,
  user_id: 'user-admin',
  organization_id: 'org-1',
  employee_id: employeeId,
  work_date: workDate,
  status,
  requested_status: status,
  approved_status: status,
  actual_status: null,
  rate_snapshot: rateSnapshot,
  created_by_profile_id: 'user-admin',
  requested_by_profile_id: 'user-admin',
  approved_by_profile_id: 'user-admin',
  actual_by_profile_id: null,
  created_at: '2026-04-22T08:00:00.000Z',
  updated_at: '2026-04-22T08:00:00.000Z',
});

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
      createShift('shift-1', 'emp-owner', '2026-05-01', 'shift', 5000),
      createShift('shift-2', 'emp-pavel', '2026-05-01', 'day_off', 4300),
      createShift('shift-3', 'emp-alina', '2026-05-01', 'no_shift', 4100),
      createShift('shift-4', 'emp-pavel', '2026-05-02', 'shift', 4300),
      createShift('shift-5', 'emp-owner', '2026-05-04', 'replacement', 5000),
      createShift('shift-6', 'emp-alina', '2026-05-02', 'sick_leave', 4100),
      createShift('shift-7', 'emp-alina', '2026-05-03', 'no_show', 4100),
    ],
    payments: [],
    rateHistory: employees.map((employee) => ({
      id: `rate-${employee.id}`,
      employee_id: employee.id,
      organization_id: 'org-1',
      rate: employee.daily_rate,
      valid_from: employee.hired_at,
      valid_to: null,
      created_by_profile_id: null,
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

const mockSupabase = async (page: Page, fixture: FixtureData, rpcCalls: RpcCalls) => {
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
      case '/rest/v1/rpc/upsert_shift_entry': {
        const payload = request.postDataJSON() as {
          employee_id_input: string;
          work_date_input: string;
          status_input: ShiftStatusFixture;
        };
        const existingIndex = fixture.shifts.findIndex((shift) => (
          shift.employee_id === payload.employee_id_input
          && shift.work_date === payload.work_date_input
        ));
        const employee = fixture.employees.find((item) => item.id === payload.employee_id_input);
        const nextShift = createShift(
          existingIndex >= 0 ? String(fixture.shifts[existingIndex].id) : `shift-new-${rpcCalls.upserts.length + 1}`,
          payload.employee_id_input,
          payload.work_date_input,
          payload.status_input,
          Number(employee?.daily_rate ?? 0),
        );

        if (existingIndex >= 0) {
          fixture.shifts[existingIndex] = nextShift;
        } else {
          fixture.shifts.push(nextShift);
        }

        rpcCalls.upserts.push({
          employeeId: payload.employee_id_input,
          date: payload.work_date_input,
          status: payload.status_input,
        });
        await fulfillJson(route, nextShift);
        return;
      }
      case '/rest/v1/rpc/delete_shift_entry': {
        const payload = request.postDataJSON() as {
          employee_id_input: string;
          work_date_input: string;
        };
        fixture.shifts = fixture.shifts.filter((shift) => !(
          shift.employee_id === payload.employee_id_input
          && shift.work_date === payload.work_date_input
        ));
        rpcCalls.deletes.push({
          employeeId: payload.employee_id_input,
          date: payload.work_date_input,
        });
        await fulfillJson(route, null);
        return;
      }
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
  const rpcCalls: RpcCalls = { upserts: [], deletes: [] };

  await mockSupabase(page, fixture, rpcCalls);
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

  return { fixture, rpcCalls };
};

const shiftCell = (page: Page, employeeId: string, date: string) => (
  page.getByTestId(`shift-cell-${employeeId}-${date}`)
);

test.describe('calendar routes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('admin calendar renders saved shifts in the table without experimental calendar', async ({ page }) => {
    await bootstrapCalendar(page, 'admin');
    await page.goto('/admin/calendar');

    await expect(page.getByTestId('legacy-calendar-shell')).toBeVisible();
    await expect(page.getByTestId('monthly-schedule-table-shell')).toBeVisible();
    await expect(page.locator('[data-testid="experimental-calendar-shell"]')).toHaveCount(0);
    await expect(page.getByTestId('monthly-schedule-header-days').locator('[data-date]')).toHaveCount(31);

    await expect(page.getByText('Никита Власов').first()).toBeVisible();
    await expect(shiftCell(page, 'emp-owner', '2026-05-01')).toHaveAttribute('data-status', 'shift');
    await expect(shiftCell(page, 'emp-pavel', '2026-05-01')).toHaveAttribute('data-status', 'day_off');
    await expect(shiftCell(page, 'emp-alina', '2026-05-01')).toHaveAttribute('data-status', 'no_shift');
    await expect(shiftCell(page, 'emp-alina', '2026-05-01')).toHaveAttribute('data-has-record', 'true');
    await expect(shiftCell(page, 'emp-owner', '2026-05-04')).toHaveAttribute('data-status', 'replacement');
    await expect(shiftCell(page, 'emp-alina', '2026-05-02')).toHaveAttribute('data-status', 'sick_leave');
    await expect(shiftCell(page, 'emp-alina', '2026-05-03')).toHaveAttribute('data-status', 'no_show');
  });

  test('admin edit updates exactly one saved cell through one upsert', async ({ page }) => {
    const { rpcCalls } = await bootstrapCalendar(page, 'admin');
    await page.goto('/admin/calendar');

    const targetCell = shiftCell(page, 'emp-pavel', '2026-05-02');
    await expect(targetCell).toHaveAttribute('data-status', 'shift');

    await targetCell.click();
    await expect(page.getByTestId('shift-status-popover')).toBeVisible();
    await page.getByTestId('shift-option-sick_leave').click();

    await expect(targetCell).toHaveAttribute('data-status', 'sick_leave');
    await expect(shiftCell(page, 'emp-owner', '2026-05-01')).toHaveAttribute('data-status', 'shift');
    expect(rpcCalls.upserts).toEqual([{ employeeId: 'emp-pavel', date: '2026-05-02', status: 'sick_leave' }]);
    expect(rpcCalls.deletes).toEqual([]);
  });

  test('saved no_shift stays saved until explicit clear', async ({ page }) => {
    const { rpcCalls } = await bootstrapCalendar(page, 'admin');
    await page.goto('/admin/calendar');

    const noShiftCell = shiftCell(page, 'emp-alina', '2026-05-01');
    await expect(noShiftCell).toHaveAttribute('data-status', 'no_shift');
    await expect(noShiftCell).toHaveAttribute('data-has-record', 'true');
    expect(rpcCalls.deletes).toEqual([]);

    await noShiftCell.click();
    await expect(page.getByTestId('shift-status-popover')).toBeVisible();
    await page.getByTestId('shift-option-none').click();

    await expect(noShiftCell).toHaveAttribute('data-status', 'no_shift');
    await expect(noShiftCell).toHaveAttribute('data-has-record', 'false');
    expect(rpcCalls.upserts).toEqual([]);
    expect(rpcCalls.deletes).toEqual([{ employeeId: 'emp-alina', date: '2026-05-01' }]);
  });

  test('employee calendar route uses the experimental workspace with readable Russian copy', async ({ page }) => {
    await bootstrapCalendar(page, 'employee');
    await page.goto('/employee/calendar');

    await expect(page.getByTestId('experimental-calendar-shell')).toBeVisible();
    await expect(page.getByTestId('legacy-calendar-shell')).toHaveCount(0);
    await expect(page.getByText('Рабочий календарь')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Старая версия' })).toBeVisible();
    await expect(page.getByText('Мой график').first()).toBeVisible();

    const mayFirstCard = page.locator('[data-day="2026-05-01"]');
    await expect(mayFirstCard).toContainText('Павел Смирнов');
    await expect(mayFirstCard).toContainText('Вых');
    await expect(mayFirstCard).not.toContainText(/ещё 1|1 more/i);

    await mayFirstCard.getByRole('button', { name: /Павел Смирнов/i }).click();
    await expect(page.getByTestId('calendar-assignment-editor')).toBeVisible();
    await expect(page.getByText('Текущий статус: Выходной')).toBeVisible();
  });

  test('employee shifts route uses the same experimental workspace with scoped editing', async ({ page }) => {
    await bootstrapCalendar(page, 'employee');
    await page.goto('/employee/shifts');

    await expect(page.getByTestId('experimental-calendar-shell')).toBeVisible();
    await expect(page.getByTestId('legacy-calendar-shell')).toHaveCount(0);

    const mayFirstCard = page.locator('[data-day="2026-05-01"]');
    await expect(mayFirstCard).toContainText('Павел Смирнов');
    await mayFirstCard.getByRole('button', { name: /Павел Смирнов/i }).click();
    await expect(page.getByTestId('calendar-assignment-editor')).toBeVisible();

    await expect(page.locator('[data-day="2026-05-01"]').getByRole('button', { name: /Никита Власов/i })).toHaveCount(0);
  });

  test('admin classic alias also renders the table schedule', async ({ page }) => {
    await bootstrapCalendar(page, 'admin');

    await page.goto('/admin/calendar/classic');
    await expect(page.getByTestId('monthly-schedule-table-shell')).toBeVisible();
  });

  test('employee classic aliases also render the table schedule', async ({ page }) => {
    await bootstrapCalendar(page, 'employee');

    await page.goto('/employee/calendar/classic');
    await expect(page.getByTestId('monthly-schedule-table-shell')).toBeVisible();

    await page.goto('/employee/shifts/classic');
    await expect(page.getByTestId('monthly-schedule-table-shell')).toBeVisible();
  });
});
