import { test, expect, type Page, type TestInfo } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

/** A name no other test, browser or earlier run will have used. */
function uniqueName(testInfo: TestInfo, label: string) {
  return `${label} E2E ${testInfo.project.name} ${Date.now().toString(36)}`;
}

/**
 * Generating creates an entry for every active recurring record, the seeded
 * ones included. Each browser generates into its own month far in the past, so
 * the entries stay out of the current-month views other specs read, and the
 * cleanup below can remove that whole month without touching another
 * browser's run.
 */
function generationMonth(testInfo: TestInfo) {
  const year =
    2001 + ['chromium', 'firefox', 'webkit'].indexOf(testInfo.project.name);
  return { date: `${year}-01-15`, from: `${year}-01-01`, to: `${year}-01-31` };
}

async function deleteRecurringByName(page: Page, name: string) {
  const response = await page.request.get('/api/recurring');
  if (!response.ok()) return;
  const records = (await response.json()) as { id: string; name: string }[];
  for (const record of records.filter((r) => r.name === name)) {
    await page.request.delete('/api/recurring', { data: { id: record.id } });
  }
}

async function countEntries(page: Page, params: Record<string, string>) {
  const response = await page.request.get(
    `/api/entries?${new URLSearchParams(params).toString()}`,
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { totalItems: number }).totalItems;
}

/**
 * Removes every entry in the range through the records table, one row at a
 * time (the same path delete.spec.ts drives).
 */
async function deleteEntriesInRange(page: Page, from: string, to: string) {
  const range = { from, to, accion: 'todos' };
  let remaining = await countEntries(page, range);
  if (remaining === 0) return;

  await page.goto(`/records?from=${from}&to=${to}&accion=todos`);
  const deleteButtons = page.getByRole('button', { name: /Eliminar entrada / });

  while (remaining > 0) {
    const before = remaining;
    await deleteButtons.first().click();
    await expect(async () => {
      remaining = await countEntries(page, range);
      expect(remaining).toBeLessThan(before);
    }).toPass({ timeout: 15000 });
  }
}

test.describe('Recurring Records', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should create a recurring record from the form', async ({
    page,
  }, testInfo) => {
    const name = uniqueName(testInfo, 'Recurrente');

    try {
      await page.goto('/recurring');
      await expect(
        page.getByRole('heading', { name: 'Recurrentes', level: 1 }),
      ).toBeVisible();

      // The form loads its categories when it opens; selecting one before
      // they arrive would hit the loading placeholders.
      await Promise.all([
        page.waitForResponse('/api/options'),
        page.getByRole('button', { name: 'Nuevo', exact: true }).click(),
      ]);
      const dialog = page.getByRole('dialog', { name: 'Nuevo recurrente' });

      await dialog.getByLabel('Nombre').fill(name);
      await dialog.getByLabel('Importe').fill('12.34');
      await dialog.getByText('Seleccionar categoría').click();
      await page.getByPlaceholder('Buscar...').last().fill('Recurrente E2E');
      await page.keyboard.press('Enter');

      await dialog.getByRole('button', { name: 'Añadir registro' }).click();

      await expect(
        page.getByText('Registro recurrente añadido correctamente', {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15000 });
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole('button', { name: `Ver ${name}` }),
      ).toBeVisible();
    } finally {
      await deleteRecurringByName(page, name);
    }
  });

  test('should generate finance entries from the active records', async ({
    page,
  }, testInfo) => {
    const name = uniqueName(testInfo, 'Generado');
    const { date, from, to } = generationMonth(testInfo);

    const created = await page.request.post('/api/recurring', {
      data: {
        name,
        accion: 'Gasto',
        tipo: 'Recurrente E2E',
        detalle1: '',
        detalle2: '',
        amount: 9.99,
        frequency: 'monthly',
        active: true,
        dia: 1,
        plataforma_pago: 'Tarjeta',
      },
    });
    expect(created.ok()).toBe(true);

    try {
      await page.goto('/recurring');
      await expect(
        page.getByRole('button', { name: `Ver ${name}` }),
      ).toBeVisible();

      await page.getByLabel('Fecha de generación').fill(date);
      page.once('dialog', async (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Generar registros' }).click();

      await expect(page.getByText(/^Generados \d+ registros$/)).toBeVisible({
        timeout: 15000,
      });

      // The new record became exactly one entry in the generated month.
      expect(await countEntries(page, { que: name, from, to })).toBe(1);
    } finally {
      await deleteRecurringByName(page, name);
      await deleteEntriesInRange(page, from, to);
    }
  });
});
