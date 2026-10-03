import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should load the dashboard with summary statistics', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/^Balance de /)).toBeVisible();
    await expect(page.getByText('Ingresos', { exact: true })).toBeVisible();
    await expect(page.getByText('Gastos', { exact: true })).toBeVisible();
  });

  test('should show the recent records', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Últimos registros')).toBeVisible();
  });

  test('should navigate to records page', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('link', { name: 'Registros' }).first().click();

    await expect(page).toHaveURL('/records');
  });
});
