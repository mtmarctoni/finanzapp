import {
  test as base,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

type CleanupTask = (page: Page) => Promise<void>;

// Fixture teardown has its own budget and runs before the page is disposed.
// Cleanup in a test's finally block can mask the original error once the
// test's timeout is exhausted.
const test = base.extend<{ cleanup: (task: CleanupTask) => void }>({
  cleanup: [
    async ({ page }, use) => {
      const tasks: CleanupTask[] = [];
      await use((task) => tasks.push(task));
      for (const task of tasks) await task(page);
    },
    { timeout: 30000 },
  ],
});

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
  expect(response.ok()).toBe(true);
  const records = (await response.json()) as { id: string; name: string }[];
  for (const record of records.filter((r) => r.name === name)) {
    const deleted = await page.request.delete('/api/recurring', {
      data: { id: record.id },
    });
    expect(deleted.ok()).toBe(true);
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
    cleanup,
  }, testInfo) => {
    const name = uniqueName(testInfo, 'Recurrente');
    cleanup(async (page) => deleteRecurringByName(page, name));

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
    const category = dialog
      .getByRole('combobox')
      .filter({ hasText: /Seleccionar categoría|Recurrente E2E/ });
    await category.click();
    await page.getByPlaceholder('Buscar...').last().fill('Recurrente E2E');
    // The category may already exist from another browser's run. Click
    // either its exact option or the create option, after cmdk renders it.
    await page
      .getByRole('option', { name: /^(Crear ")?Recurrente E2E"?$/ })
      .click();
    await expect(category).toHaveText('Recurrente E2E');

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
  });

  test('should generate finance entries from the active records', async ({
    page,
    cleanup,
  }, testInfo) => {
    const name = uniqueName(testInfo, 'Generado');
    const { date, from, to } = generationMonth(testInfo);
    cleanup(async (page) => deleteRecurringByName(page, name));
    cleanup(async (page) => deleteEntriesInRange(page, from, to));

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
  });
});
