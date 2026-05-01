import { expect, test, type Page, type Route } from '@playwright/test';

const SUPABASE_URL = 'https://nqwxeuewkimonifeckdr.supabase.co';
const SUPABASE_STORAGE_KEY = 'sb-nqwxeuewkimonifeckdr-auth-token';
const LANGUAGE_STORAGE_KEY = 'pvz-schedule.language';
const PREFERENCES_STORAGE_KEY = 'pvz-schedule-ui-v1';

type FixtureRole = 'admin' | 'employee';
type PaymentStatusFixture = 'pending' | 'approved' | 'rejected';

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
  creates: Array<{
    employeeId: string;
    amount: number;
    date: string;
    comment: string;
  }>;
  monthStatuses: string[];
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
  rateSnapshot: number,
) => ({
  id,
  user_id: 'user-admin',
  organization_id: 'org-1',
  employee_id: employeeId,
  work_date: workDate,
  status: 'shift',
  requested_status: 'shift',
  approved_status: 'shift',
  actual_status: 'shift',
  rate_snapshot: rateSnapshot,
  created_by_profile_id: 'user-admin',
  requested_by_profile_id: 'user-admin',
  approved_by_profile_id: 'user-admin',
  actual_by_profile_id: 'user-admin',
  created_at: '2026-04-01T08:00:00.000Z',
  updated_at: '2026-04-01T08:00:00.000Z',
});

const createPaymentRow = (
  id: string,
  employeeId: string,
  amount: number,
  paymentDate: string,
  comment: string,
  status: PaymentStatusFixture,
  createdAt: string,
) => ({
  id,
  user_id: 'user-admin',
  organization_id: 'org-1',
  employee_id: employeeId,
  amount,
  payment_date: paymentDate,
  comment,
  status,
  requested_by_auth_user_id: 'user-admin',
  created_by_auth_user_id: 'user-admin',
  approved_by_auth_user_id: status === 'approved' ? 'user-admin' : null,
  confirmed_by_auth_user_id: null,
  requested_by_profile_id: 'user-admin',
  created_by_profile_id: 'user-admin',
  approved_by_profile_id: status === 'approved' ? 'user-admin' : null,
  confirmed_by_profile_id: null,
  approved_at: status === 'approved' ? createdAt : null,
  edited_by_admin: false,
  created_at: createdAt,
  updated_at: createdAt,
});

const buildFixtureData = (role: FixtureRole): FixtureData => {
  const authUserId = role === 'admin' ? 'user-admin' : 'user-employee';
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = createFakeJwt(authUserId, expiresAt);
  const baseNow = '2026-04-23T08:00:00.000Z';

  const employees = [
    {
      id: 'emp-owner',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: 'user-admin',
      auth_user_id: 'user-admin',
      work_email: 'tatiana@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: true,
      hired_at: '2026-01-01',
      terminated_at: null,
      name: 'Tatiana Owner',
      daily_rate: 0,
      archived: false,
      archived_at: null,
      created_at: '2026-01-01T08:00:00.000Z',
      updated_at: baseNow,
    },
    {
      id: 'emp-nick',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: 'user-employee',
      auth_user_id: 'user-employee',
      work_email: 'nick@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: false,
      hired_at: '2026-01-02',
      terminated_at: null,
      name: 'Nick',
      daily_rate: 5000,
      archived: false,
      archived_at: null,
      created_at: '2026-01-02T08:00:00.000Z',
      updated_at: baseNow,
    },
    {
      id: 'emp-pavel',
      user_id: 'user-admin',
      organization_id: 'org-1',
      profile_id: null,
      auth_user_id: null,
      work_email: 'pavel@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: false,
      hired_at: '2026-01-03',
      terminated_at: null,
      name: 'Pavel',
      daily_rate: 4500,
      archived: false,
      archived_at: null,
      created_at: '2026-01-03T08:00:00.000Z',
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
        email: role === 'admin' ? 'tatiana@example.com' : 'nick@example.com',
        email_confirmed_at: '2026-04-01T00:00:00.000Z',
        phone: '',
        confirmed_at: '2026-04-01T00:00:00.000Z',
        last_sign_in_at: baseNow,
        app_metadata: {
          provider: 'email',
          providers: ['email'],
        },
        user_metadata: {
          name: role === 'admin' ? 'Tatiana Owner' : 'Nick',
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
      display_name: role === 'admin' ? 'Tatiana Owner' : 'Nick',
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
      createShift('shift-nick-1', 'emp-nick', '2026-04-01', 5000),
      createShift('shift-nick-2', 'emp-nick', '2026-04-02', 5000),
      createShift('shift-pavel-1', 'emp-pavel', '2026-04-03', 4500),
    ],
    payments: [
      createPaymentRow('payment-nick-approved', 'emp-nick', 6000, '2026-04-10', 'Salary advance', 'approved', '2026-04-10T09:00:00.000Z'),
      createPaymentRow('payment-nick-pending', 'emp-nick', 1000, '2026-04-11', 'Employee request', 'pending', '2026-04-11T09:00:00.000Z'),
      createPaymentRow('payment-nick-march-approved', 'emp-nick', 2500, '2026-03-29', 'Previous month carry', 'approved', '2026-03-29T09:00:00.000Z'),
      createPaymentRow('payment-pavel-approved', 'emp-pavel', 4500, '2026-04-12', 'April payout', 'approved', '2026-04-12T09:00:00.000Z'),
    ],
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
        id: 'month-2026-04',
        organization_id: 'org-1',
        year: 2026,
        month: 4,
        status: 'approved',
        approved_by_profile_id: 'user-admin',
        approved_at: '2026-04-20T09:00:00.000Z',
        closed_by_profile_id: null,
        closed_at: null,
        created_at: '2026-04-01T00:00:00.000Z',
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
      case '/rest/v1/rpc/create_payment_record': {
        const payload = request.postDataJSON() as {
          employee_id_input: string;
          amount_input: number;
          payment_date_input: string;
          comment_input: string;
        };
        const now = new Date().toISOString();
        const nextPayment = createPaymentRow(
          `payment-new-${rpcCalls.creates.length + 1}`,
          payload.employee_id_input,
          payload.amount_input,
          payload.payment_date_input,
          payload.comment_input,
          'approved',
          now,
        );

        fixture.payments.unshift(nextPayment);
        rpcCalls.creates.push({
          employeeId: payload.employee_id_input,
          amount: payload.amount_input,
          date: payload.payment_date_input,
          comment: payload.comment_input,
        });
        await fulfillJson(route, nextPayment);
        return;
      }
      case '/rest/v1/rpc/set_schedule_month_status': {
        const payload = request.postDataJSON() as { status_input: string };
        const row = {
          ...fixture.scheduleMonths[0],
          status: payload.status_input,
          updated_at: new Date().toISOString(),
        };
        fixture.scheduleMonths[0] = row;
        rpcCalls.monthStatuses.push(payload.status_input);
        await fulfillJson(route, row);
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

const bootstrapDashboard = async (page: Page, role: FixtureRole) => {
  const fixture = buildFixtureData(role);
  const rpcCalls: RpcCalls = { creates: [], monthStatuses: [] };

  await mockSupabase(page, fixture, rpcCalls);
  await page.addInitScript(
    ({ session, storageKey, languageStorageKey, preferencesStorageKey }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      window.localStorage.setItem(languageStorageKey, 'en');
      window.localStorage.setItem(preferencesStorageKey, JSON.stringify({
        selectedMonth: 4,
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

test.describe('dashboard payroll redesign', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('admin sees payroll calculator and employee balances without month closing controls', async ({ page }) => {
    await bootstrapDashboard(page, 'admin');
    await page.goto('/admin/dashboard');

    await expect(page.getByTestId('owner-payroll-dashboard')).toBeVisible();
    await expect(page.getByTestId('payroll-calculator')).toContainText('Remaining payroll for the month');
    await expect(page.getByTestId('payroll-employee-row')).toHaveCount(2);
    await expect(page.getByText('Tatiana Owner')).toHaveCount(1);
    await expect(page.getByTestId('payroll-employee-row').filter({ hasText: 'Tatiana Owner' })).toHaveCount(0);
    await expect(page.getByTestId('payroll-employee-row').filter({ hasText: 'Nick' })).toContainText('RUB');
    await expect(page.getByText('Ready to close')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Close month|Month closed/ })).toHaveCount(0);
  });

  test('pay balance opens a prefilled payment dialog', async ({ page }) => {
    const { rpcCalls } = await bootstrapDashboard(page, 'admin');
    await page.goto('/admin/dashboard');

    await page.getByTestId('payroll-pay-balance-emp-nick').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('#payment-employee')).toHaveValue('emp-nick');
    await expect(page.locator('#payment-amount')).toHaveValue('4000');
    await expect(page.locator('#payment-comment')).toHaveValue(/Payroll payment for April 2026/);

    await page.locator('[role="dialog"]').getByRole('button', { name: 'Record payment' }).click();

    await expect.poll(() => rpcCalls.creates.length).toBe(1);
    expect(rpcCalls.creates[0]).toMatchObject({
      employeeId: 'emp-nick',
      amount: 4000,
    });
  });

  test('employee sees a simple personal payroll explanation only', async ({ page }) => {
    await bootstrapDashboard(page, 'employee');
    await page.goto('/employee/dashboard');

    await expect(page.getByTestId('employee-payroll-dashboard')).toBeVisible();
    await expect(page.getByTestId('owner-payroll-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('employee-payroll-dashboard')).toContainText('RUB 1,500');
    await expect(page.getByTestId('employee-payroll-formula')).toContainText('Calculation to date');
    await expect(page.getByTestId('employee-payroll-formula')).toContainText('Selected month separately');
    await expect(page.getByTestId('employee-payroll-formula')).toContainText('RUB 4,000');
    await expect(page.getByTestId('employee-payment-row')).toHaveCount(2);
    await expect(page.getByText('April payout')).toHaveCount(0);
    await expect(page.getByTestId('payroll-pay-balance-emp-nick')).toHaveCount(0);
  });

  test('mobile dashboard avoids page-level horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootstrapDashboard(page, 'admin');
    await page.goto('/admin/dashboard');

    await expect(page.getByTestId('payroll-calculator')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });
});
