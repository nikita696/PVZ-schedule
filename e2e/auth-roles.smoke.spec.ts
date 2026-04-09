import { expect, test, type Page } from '@playwright/test';

const hasSupabaseConfig = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY,
);

const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL ?? '',
  password: process.env.E2E_ADMIN_PASSWORD ?? '',
};

const employeeCredentials = {
  email: process.env.E2E_EMPLOYEE_EMAIL ?? '',
  password: process.env.E2E_EMPLOYEE_PASSWORD ?? '',
};

const unlinkedCredentials = {
  email: process.env.E2E_UNLINKED_EMAIL ?? '',
  password: process.env.E2E_UNLINKED_PASSWORD ?? '',
};

const canUseAdminCredentials = Boolean(
  hasSupabaseConfig && adminCredentials.email && adminCredentials.password,
);

const canUseEmployeeCredentials = Boolean(
  hasSupabaseConfig && employeeCredentials.email && employeeCredentials.password,
);

const canUseUnlinkedCredentials = Boolean(
  hasSupabaseConfig && unlinkedCredentials.email && unlinkedCredentials.password,
);

const loginViaAuthPage = async (page: Page, email: string, password: string) => {
  await page.goto('/auth/login');
  const activeTab = page.locator('[role="tabpanel"][data-state="active"]').first();

  await activeTab.locator('input[type="email"]').first().fill(email);
  await activeTab.locator('input[type="password"]').first().fill(password);
  await activeTab.locator('button').first().click();
};

test.describe('auth and roles smoke', () => {
  test('guest is redirected to /auth/login from protected routes', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('admin account lands on /admin/dashboard and cannot stay in employee area', async ({ page }) => {
    test.skip(!canUseAdminCredentials, 'Missing E2E_ADMIN_* or Supabase env secrets.');

    await loginViaAuthPage(page, adminCredentials.email, adminCredentials.password);
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  });

  test('employee account lands on /employee/dashboard and cannot stay in admin area', async ({ page }) => {
    test.skip(!canUseEmployeeCredentials, 'Missing E2E_EMPLOYEE_* or Supabase env secrets.');

    await loginViaAuthPage(page, employeeCredentials.email, employeeCredentials.password);
    await expect(page).toHaveURL(/\/employee\/dashboard$/);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/employee\/dashboard$/);
  });

  test('unlinked account is sent to activation flow', async ({ page }) => {
    test.skip(!canUseUnlinkedCredentials, 'Missing E2E_UNLINKED_* or Supabase env secrets.');

    await loginViaAuthPage(page, unlinkedCredentials.email, unlinkedCredentials.password);
    await expect(page).toHaveURL(/\/auth\/activate-employee$/);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/activate-employee$/);
  });
});
