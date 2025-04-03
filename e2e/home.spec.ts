import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page with finance table', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Verify that the page loaded correctly
    await expect(page).toHaveTitle(/Finanzapp/);
    
    // Check for main components
    await expect(page.getByPlaceholder('Buscar...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible();
    
    // Check for table headers
    await expect(page.getByRole('columnheader', { name: 'Fecha' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tipo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Acción' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Qué' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Cantidad' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();
  });

  test('should filter entries by search term', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Enter a search term
    await page.getByPlaceholder('Buscar...').fill('test search');
    
    // Click the search button
    await page.getByRole('button', { name: 'Buscar' }).click();
    
    // Verify URL contains the search parameter
    await expect(page).toHaveURL(/.*search=test%20search.*/);
    
    // Wait for the table to update
    await page.waitForLoadState('networkidle');
  });

  test('should filter entries by type', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Open the type dropdown
    await page.getByText('Todos los tipos').click();
    
    // Select "Ingreso" type
    await page.getByRole('option', { name: 'Ingreso' }).click();
    
    // Click the search button
    await page.getByRole('button', { name: 'Buscar' }).click();
    
    // Verify URL contains the tipo parameter
    await expect(page).toHaveURL(/.*tipo=Ingreso.*/);
    
    // Wait for the table to update
    await page.waitForLoadState('networkidle');
  });

  test('should reset filters when clear button is clicked', async ({ page }) => {
    // Navigate to the home page with filters applied
    await page.goto('/?search=test&tipo=Ingreso');
    
    // Verify that the filters are applied
    await expect(page.getByPlaceholder('Buscar...')).toHaveValue('test');
    
    // Click the clear button
    await page.getByRole('button', { name: 'Limpiar' }).click();
    
    // Verify URL does not contain any filter parameters
    await expect(page).toHaveURL('/');
    
    // Verify that the filters are reset
    await expect(page.getByPlaceholder('Buscar...')).toHaveValue('');
  });
});
