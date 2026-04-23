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
    status: PaymentStatusFixture;
  }>;
  updates: Array<{ paymentId: string }>;
  deletes: string[];
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
      work_email: 'nik@example.com',
      status: 'active',
      created_by_profile_id: 'user-admin',
      is_owner: true,
      hired_at: '2026-01-01',
      terminated_at: null,
      name: 'Nikita Owner',
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
      hired_at: '2026-01-02',
      terminated_at: null,
      name: 'Pavel Smirnov',
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
      name: 'Alina Vorobeva',
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
          name: role === 'admin' ? 'Nikita Owner' : 'Pavel Smirnov',
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
      display_name: role === 'admin' ? 'Nikita Owner' : 'Pavel Smirnov',
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
    shifts: [],
    payments: [
      createPaymentRow(
        'payment-apr-approved',
        'emp-pavel',
        4300,
        '2026-04-21',
        'April salary payout with a deliberately long note that should stay compact',
        'approved',
        '2026-04-21T09:00:00.000Z',
      ),
      createPaymentRow(
        'payment-apr-pending',
        'emp-alina',
        1000,
        '2026-04-20',
        'Legacy pending cash note',
        'pending',
        '2026-04-20T09:00:00.000Z',
      ),
      createPaymentRow(
        'payment-mar-rejected',
        'emp-pavel',
        500,
        '2026-03-15',
        'Rejected correction kept for history',
        'rejected',
        '2026-03-15T09:00:00.000Z',
      ),
      createPaymentRow(
        'payment-mar-approved',
        'emp-owner',
        5000,
        '2026-03-01',
        'Owner March payout',
        'approved',
        '2026-03-01T09:00:00.000Z',
      ),
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
    scheduleMonths: [],
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
          status: 'approved',
        });
        await fulfillJson(route, nextPayment);
        return;
      }
      case '/rest/v1/rpc/update_payment_record': {
        const payload = request.postDataJSON() as { payment_id_input: string };
        rpcCalls.updates.push({ paymentId: payload.payment_id_input });
        const payment = fixture.payments.find((item) => item.id === payload.payment_id_input);
        await fulfillJson(route, payment ?? null);
        return;
      }
      case '/rest/v1/rpc/delete_payment_record': {
        const payload = request.postDataJSON() as { payment_id_input: string };
        fixture.payments = fixture.payments.filter((item) => item.id !== payload.payment_id_input);
        rpcCalls.deletes.push(payload.payment_id_input);
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

const bootstrapPayments = async (page: Page, role: FixtureRole) => {
  const fixture = buildFixtureData(role);
  const rpcCalls: RpcCalls = { creates: [], updates: [], deletes: [] };

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

test.describe('payments journal', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('admin sees existing payments grouped by month without approval controls', async ({ page }) => {
    await bootstrapPayments(page, 'admin');
    await page.goto('/admin/payments');

    await expect(page.getByTestId('payments-journal')).toBeVisible();
    await expect(page.getByTestId('payments-summary')).toBeVisible();

    const summaryBox = await page.getByTestId('payments-summary').boundingBox();
    expect(summaryBox?.height ?? 0).toBeLessThan(240);

    const groups = page.getByTestId('payment-month-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toHaveAttribute('data-month-key', '2026-04');
    await expect(groups.nth(1)).toHaveAttribute('data-month-key', '2026-03');
    await expect(groups.nth(0)).toContainText('April 2026');
    await expect(groups.nth(1)).toContainText('March 2026');

    await expect(page.getByTestId('payment-month-content-2026-04')).toBeVisible();
    await expect(page.getByTestId('payment-month-content-2026-03')).not.toBeVisible();
    await expect(page.getByText('April salary payout with a deliberately long note')).toBeVisible();
    await expect(page.getByText('Rejected correction kept for history')).toHaveCount(0);
    await expect(page.getByTestId('payment-legacy-status')).toHaveCount(1);
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Approve|Reject/ })).toHaveCount(0);

    await page.getByTestId('collapse-all-months').click();
    await expect(page.getByTestId('payment-month-content-2026-04')).not.toBeVisible();
    await expect(page.getByText('April salary payout with a deliberately long note')).toHaveCount(0);

    await page.getByTestId('expand-all-months').click();
    await expect(page.getByTestId('payment-month-content-2026-03')).toBeVisible();
    await expect(page.getByText('Legacy pending cash note')).toBeVisible();
    await expect(page.getByText('Rejected correction kept for history')).toBeVisible();

    const firstActionsBox = await page.getByTestId('payment-actions').first().boundingBox();
    expect(firstActionsBox?.width ?? 999).toBeLessThan(180);
  });

  test('admin-created payment is recorded as approved for payroll compatibility', async ({ page }) => {
    const { rpcCalls } = await bootstrapPayments(page, 'admin');
    await page.goto('/admin/payments');

    await page.getByTestId('add-payment-button').click();
    await page.locator('#payment-employee').selectOption('emp-pavel');
    await page.locator('#payment-amount').fill('1234');
    await page.locator('#payment-date').fill('2026-04-23');
    await page.locator('#payment-comment').fill('One-cell journal payment');
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Record payment' }).click();

    await expect(page.getByText('One-cell journal payment')).toBeVisible();
    expect(rpcCalls.creates).toEqual([{
      employeeId: 'emp-pavel',
      amount: 1234,
      date: '2026-04-23',
      comment: 'One-cell journal payment',
      status: 'approved',
    }]);
    await expect(page.getByTestId('payment-row')).toHaveCount(3);

    await page.getByTestId('expand-all-months').click();
    await expect(page.getByTestId('payment-row')).toHaveCount(5);
  });

  test('employee sees only own payment history as read-only journal', async ({ page }) => {
    await bootstrapPayments(page, 'employee');
    await page.goto('/employee/payments');

    await expect(page.getByTestId('payments-journal')).toBeVisible();
    await expect(page.getByText('April salary payout with a deliberately long note')).toBeVisible();
    await page.getByTestId('expand-all-months').click();
    await expect(page.getByText('Rejected correction kept for history')).toBeVisible();
    await expect(page.getByText('Legacy pending cash note')).toHaveCount(0);
    await expect(page.getByTestId('add-payment-button')).toHaveCount(0);
    await expect(page.getByTestId('payment-actions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit|Delete|Approve|Reject/ })).toHaveCount(0);
  });

  test('mobile journal keeps the monthly structure readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootstrapPayments(page, 'admin');
    await page.goto('/admin/payments');

    await expect(page.getByTestId('payments-journal')).toBeVisible();
    await expect(page.getByTestId('payment-month-group').first()).toContainText('April 2026');
    await expect(page.getByText('April salary payout with a deliberately long note')).toBeVisible();

    const summaryBox = await page.getByTestId('payments-summary').boundingBox();
    expect(summaryBox?.height ?? 999).toBeLessThan(360);
  });
});
