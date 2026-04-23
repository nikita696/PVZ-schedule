import { expect, test } from '@playwright/test';

test.describe('auth and localization smoke', () => {
  test('guest is redirected to /auth/login from protected routes', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goto('/employee/dashboard');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('auth page exposes email/password controls and russian defaults', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('heading', { name: 'Вход по email и паролю' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Вход/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Регистрация/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Сброс/ })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Пароль')).toBeVisible();
    await expect(page.getByRole('button', { name: /EN/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('language switch changes auth page to english and persists after reload', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByRole('button', { name: /EN/ }).click();

    await expect(page.getByRole('heading', { name: 'Email and password sign-in' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sign in/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sign up/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Reset/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /RU/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Email and password sign-in' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sign in/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /RU/ })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem('pvz-schedule.language'))).resolves.toBe('en');
  });

  test('sign-up and password reset tabs expose the expected fields', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByRole('tab', { name: /Регистрация/ }).click();
    await expect(page.getByLabel('Имя в приложении')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Создать аккаунт' })).toBeVisible();

    await page.getByRole('tab', { name: /Сброс/ }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отправить ссылку' })).toBeVisible();
  });

  test('legacy auth routes keep redirecting into the localized login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /EN/ }).click();

    await page.goto('/auth/register-admin');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Email and password sign-in' })).toBeVisible();

    await page.goto('/auth/activate-employee');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Email and password sign-in' })).toBeVisible();
  });
});
