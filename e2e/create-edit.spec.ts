import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';
import { openQuickAdd } from './utils/quick-add';

test.describe('Create and Edit Finance Entries', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should add an entry from the quick-add sheet', async ({ page }) => {
    await openQuickAdd(page);
    const sheet = page.getByRole('dialog', { name: 'Nuevo registro' });

    // Nothing filled in yet: the save button names what is missing.
    await expect(sheet.getByRole('button', { name: /Falta/ })).toBeVisible();

    for (const key of ['1', '2', 'Coma decimal', '5']) {
      await sheet.getByRole('button', { name: key, exact: true }).click();
    }
    await sheet.getByLabel('Qué', { exact: true }).fill('Que Sheet E2E');

    await sheet
      .getByRole('group', { name: 'Categoría' })
      .getByRole('button', { name: 'Otra' })
      .click();
    await sheet.getByLabel('Añadir categoría').fill('Tipo E2E');
    await sheet.getByRole('button', { name: 'Usar' }).click();

    await sheet
      .getByRole('group', { name: 'Pago' })
      .getByRole('button', { name: 'Otra' })
      .click();
    await sheet.getByLabel('Añadir pago').fill('Plataforma E2E');
    await sheet.getByRole('button', { name: 'Usar' }).click();

    await sheet.getByRole('button', { name: /Guardar gasto/ }).click();

    await expect(page.getByText('Gasto guardado', { exact: true })).toBeVisible(
      { timeout: 15000 },
    );
    await expect(sheet).toBeHidden();
  });

  test('should create an entry with the full form', async ({ page }) => {
    await Promise.all([
      page.waitForResponse('/api/options'),
      page.goto('/new'),
    ]);

    await expect(
      page.getByRole('heading', { name: 'Nuevo registro' }),
    ).toBeVisible();

    await page.getByLabel('Cantidad').fill('1500');
    await page.getByRole('radio', { name: 'Ingreso' }).click();

    await page.getByText('Seleccionar categoría...').click();
    await page.getByPlaceholder('Buscar...').last().fill('Tipo E2E');
    await page.keyboard.press('Enter');

    await page.getByText('Seleccionar qué...').click();
    await page.getByPlaceholder('Buscar...').last().fill('Que E2E');
    await page.keyboard.press('Enter');

    await page.getByText('Seleccionar plataforma...').click();
    await page.getByPlaceholder('Buscar...').last().fill('Plataforma E2E');
    await page.keyboard.press('Enter');

    await page.getByLabel('Hora').fill('10:30');
    await page.getByLabel('Nota', { exact: true }).fill('Test detalle 1');
    await page.getByLabel('Nota 2').fill('Test detalle 2');

    await page.getByRole('button', { name: 'Guardar' }).click();

    await page.waitForURL(/\/records/, { timeout: 30000 });
  });

  test('should edit an existing entry', async ({ page }) => {
    await page.goto('/records');

    const editButton = page
      .getByRole('button', { name: /Editar entrada/ })
      .first();
    await editButton.waitFor({ state: 'attached', timeout: 10000 });

    await editButton.click();

    await page.waitForURL(/\/edit\//);

    await page.waitForSelector('form');

    await page.getByLabel('Cantidad').fill('2000');

    await page.getByRole('button', { name: 'Actualizar' }).click();

    await page.waitForURL('/records', { timeout: 15000 });
  });
});
