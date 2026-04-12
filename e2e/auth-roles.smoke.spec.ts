import { expect, test } from '@playwright/test';

test.describe('auth and localization smoke', () => {
  test('guest is redirected to /auth/login from protected routes', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('auth page exposes language toggle and russian defaults', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: 'Вход и регистрация через Яндекс ID' })).toBeVisible();
    await expect(page.getByText('Роль при первом входе')).toBeVisible();
    await expect(page.getByRole('button', { name: /RU/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /EN/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти через Яндекс ID' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти другим Яндекс-аккаунтом' })).toBeVisible();
  });

  test('language switch changes auth page to english and persists after reload', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByRole('button', { name: /EN/ }).click();

    await expect(page.getByRole('heading', { name: 'Sign in and register with Yandex ID' })).toBeVisible();
    await expect(page.getByText('Role on first sign-in')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Yandex ID' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use a different Yandex account' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Sign in and register with Yandex ID' })).toBeVisible();
    await expect(page.getByText('Role on first sign-in')).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem('pvz-schedule.language'))).resolves.toBe('en');
  });

  test('legacy auth routes keep redirecting into the localized login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /EN/ }).click();

    await page.goto('/auth/register-admin');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in and register with Yandex ID' })).toBeVisible();

    await page.goto('/auth/activate-employee');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in and register with Yandex ID' })).toBeVisible();
  });
});
