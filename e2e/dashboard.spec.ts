import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should load the dashboard with summary statistics', async ({ page }) => {
    // Navigate to the dashboard page
    await page.goto('/dashboard');
    
    // Verify that the page loaded correctly
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Check for summary cards
    await expect(page.getByText('Total Ingresos')).toBeVisible();
    await expect(page.getByText('Total Gastos')).toBeVisible();
    await expect(page.getByText('Total Inversiones')).toBeVisible();
    await expect(page.getByText('Balance')).toBeVisible();
    
    // Check for numeric values in the summary cards
    // We're checking that there are numbers displayed, not specific values
    const incomeCard = page.locator('div', { hasText: 'Total Ingresos' });
    await expect(incomeCard.locator('div:has-text(/€[0-9,.]+/)')).toBeVisible();
    
    const expenseCard = page.locator('div', { hasText: 'Total Gastos' });
    await expect(expenseCard.locator('div:has-text(/€[0-9,.]+/)')).toBeVisible();
    
    const investmentCard = page.locator('div', { hasText: 'Total Inversiones' });
    await expect(investmentCard.locator('div:has-text(/€[0-9,.]+/)')).toBeVisible();
    
    const balanceCard = page.locator('div', { hasText: 'Balance' });
    await expect(balanceCard.locator('div:has-text(/€[0-9,.]+/)')).toBeVisible();
  });

  test('should display charts with financial data', async ({ page }) => {
    // Navigate to the dashboard page
    await page.goto('/dashboard');
    
    // Check for charts
    // Recharts uses SVG elements, so we'll check for those
    await expect(page.locator('svg')).toBeVisible();
    
    // Check for chart titles or legends
    await expect(page.getByText('Ingresos vs Gastos')).toBeVisible();
    
    // Wait for charts to fully render
    await page.waitForTimeout(1000);
  });

  test('should navigate back to home page', async ({ page }) => {
    // Navigate to the dashboard page
    await page.goto('/dashboard');
    
    // Click on the "Ver todas las entradas" link
    await page.getByRole('link', { name: 'Ver todas las entradas' }).click();
    
    // Verify that we're redirected to the home page
    await expect(page).toHaveURL('/');
  });
});
