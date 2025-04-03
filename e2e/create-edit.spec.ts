import { test, expect } from '@playwright/test';
import { format } from 'date-fns';

test.describe('Create and Edit Finance Entries', () => {
  test('should navigate to create page and create a new entry', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Click on the "Nueva entrada" button
    await page.getByRole('link', { name: 'Nueva entrada' }).click();
    
    // Verify that we're on the create page
    await expect(page).toHaveURL('/create');
    await expect(page.getByRole('heading', { name: 'Nueva entrada' })).toBeVisible();
    
    // Fill out the form
    const today = format(new Date(), 'yyyy-MM-dd');
    await page.getByLabel('Fecha').fill(today);
    
    // Select "Ingreso" type
    await page.getByText('Selecciona un tipo').click();
    await page.getByRole('option', { name: 'Ingreso' }).click();
    
    await page.getByLabel('Acción').fill('Salario Test');
    await page.getByLabel('Qué').fill('Trabajo E2E Test');
    
    // Select payment platform
    await page.getByText('Selecciona plataforma').click();
    await page.getByRole('option', { name: 'Transferencia' }).click();
    
    await page.getByLabel('Cantidad').fill('1500');
    await page.getByLabel('Detalle 1').fill('Test detalle 1');
    await page.getByLabel('Detalle 2').fill('Test detalle 2');
    
    // Submit the form
    await page.getByRole('button', { name: 'Guardar' }).click();
    
    // Verify that we're redirected back to the home page
    await expect(page).toHaveURL('/');
    
    // Verify that the new entry appears in the table
    await expect(page.getByText('Salario Test')).toBeVisible();
    await expect(page.getByText('Trabajo E2E Test')).toBeVisible();
  });

  test('should edit an existing entry', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Wait for the table to load
    await page.waitForSelector('table');
    
    // Click on the edit button for the first entry
    const editButtons = await page.getByRole('link', { name: 'Edit' }).all();
    if (editButtons.length > 0) {
      await editButtons[0].click();
      
      // Verify that we're on the edit page
      await expect(page.url()).toContain('/edit/');
      
      // Wait for the form to load with existing data
      await page.waitForSelector('form');
      
      // Modify the entry
      await page.getByLabel('Acción').fill('Salario Modificado');
      await page.getByLabel('Cantidad').fill('2000');
      
      // Submit the form
      await page.getByRole('button', { name: 'Guardar' }).click();
      
      // Verify that we're redirected back to the home page
      await expect(page).toHaveURL('/');
      
      // Verify that the edited entry appears in the table
      await expect(page.getByText('Salario Modificado')).toBeVisible();
    } else {
      test.skip(true, 'No entries available to edit');
    }
  });
});
