import { expect, test } from '@playwright/test';

test.describe('auth and registration smoke', () => {
  test('guest is redirected to /auth/login from protected routes', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('auth page contains registration controls', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: 'Регистрация нового пользователя' })).toBeVisible();
    await expect(page.getByLabel('Email').first()).toBeVisible();
    await expect(page.getByText('Зарегистрировать как администратора')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Зарегистрироваться по email' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Получить ссылку для входа/ })).toBeVisible();
  });

  test('legacy auth routes redirect to /auth/login', async ({ page }) => {
    await page.goto('/auth/register-admin');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto('/auth/activate-employee');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
