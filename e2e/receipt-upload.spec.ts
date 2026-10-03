import { test, expect } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';
import { openReceiptSheet } from './utils/quick-add';

/** Smallest byte sequence the server accepts as a JPEG (SOI + marker). */
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const CANNED_PARSE = {
  success: true,
  duplicate: false,
  parsedData: {
    fecha: '2026-09-20',
    hora: 12,
    minuto: 30,
    tipo: 'Supermercado',
    accion: 'Gasto',
    que: 'Mercadona E2E',
    plataforma_pago: 'Visa',
    cantidad: 43.2,
    detalle1: 'Leche y pan',
    detalle2: '',
  },
  receipt: {
    contentHash: 'a'.repeat(64),
    confianza: 0.9,
    needsReview: false,
    comercio: 'Mercadona E2E',
    categorySource: 'model',
  },
  providerUsed: 'opencode',
  modelUsed: 'mimo-v2.5-free',
};

test.describe('Receipt upload', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('prefills the form, and a correction is what gets remembered', async ({
    page,
  }) => {
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({ status: 200, json: CANNED_PARSE });
    });

    await openReceiptSheet(page);
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_BYTES,
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    await expect(page).toHaveURL(/\/new\?/);
    await expect(page).toHaveURL(/rcpt=1/);
    await expect(
      page.getByRole('heading', { name: 'Revisar entrada' }),
    ).toBeVisible();

    // The category/merchant options are fetched after /new mounts, so wait for
    // the network to settle before clicking a combobox. (The plan's
    // `waitForResponse('/api/options')` works but can lose the race, because it
    // is registered after the navigation that triggers the request.)
    await page.waitForLoadState('networkidle');

    // The user disagrees with the prefill.
    //
    // Selectors are the combobox accessible names ("Acción", "Tipo", "Qué",
    // "Plataforma de pago"), not the placeholder text. Two traps here:
    //   1. The plan's `Seleccionar tipo...` placeholder is *gone* the moment
    //      the receipt prefills Tipo with "Supermercado".
    //   2. The sibling placeholder `Selecciona un tipo` is `accion`
    //      (Ingreso/Gasto). Choosing a category from that combobox silently
    //      records an income or an expense instead, and the assertions at the
    //      bottom then fail for a reason unrelated to this feature.
    await page.getByRole('combobox', { name: 'Categoría' }).click();
    await page.getByRole('option', { name: 'Limpieza' }).click();

    // `Qué` is already "Mercadona E2E" from the prefill, so there is nothing
    // to re-select: the point of the test is which category gets remembered.

    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.waitForURL(/\/records/, { timeout: 30000 });

    // Learned merchants are listed on the profile page.
    await page.goto('/user');

    // The remembered category is the saved one, not the prefill. The merchant
    // did not exist before this save, so `applyMerchantConfirmation` inserts
    // it with veces_confirmado = 1 and veces_corregido = 0 — the category the
    // user typed is what the memory holds.
    const row = page.getByRole('listitem').filter({ hasText: 'Mercadona E2E' });
    await expect(row).toContainText('Limpieza');
    await expect(row).not.toContainText('Supermercado');
    // `1 confirmada` and `3 confirmadas` both have to satisfy this.
    await expect(row).toContainText(/confirmada/);
  });

  test('rejects a non-image before the model is reached', async ({ page }) => {
    // Deliberately not stubbed: the point is the server's own magic-byte guard.
    await openReceiptSheet(page);
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    // 415 from validateImageUpload, with a message that tells the user what
    // the accepted formats are.
    await expect(
      page.getByRole('status').filter({ hasText: 'no es una imagen válida' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('says so when the receipt is already saved', async ({ page }) => {
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          duplicate: true,
          duplicateKind: 'exact',
          entry: { id: 'e-1', que: 'Mercadona E2E', cantidad: 43.2 },
        },
      });
    });

    await openReceiptSheet(page);
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_BYTES,
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Ya tienes esta entrada' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
