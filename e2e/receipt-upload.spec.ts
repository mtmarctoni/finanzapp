import { randomBytes } from 'node:crypto';

import { test as base, expect, type Page } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';
import { openReceiptSheet } from './utils/quick-add';

import type { MerchantRecord } from '@/lib/merchants/repo';

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
    plataforma_pago: 'Visa',
    cantidad: 43.2,
    detalle1: 'Leche y pan',
    detalle2: '',
  },
  receipt: {
    confianza: 0.9,
    needsReview: false,
    categorySource: 'model',
  },
  providerUsed: 'opencode',
  modelUsed: 'mimo-v2.5-free',
};

async function receiptEntries(page: Page, merchant: string) {
  const response = await page.request.get(
    `/api/entries?${new URLSearchParams({ que: merchant, accion: 'todos' })}`,
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    totalItems: number;
    data: {
      id: string;
      que: string;
      tipo: string;
      cantidad: number | string;
    }[];
  };
}

async function receiptMerchants(page: Page, merchant: string) {
  const response = await page.request.get('/api/merchants');
  expect(response.ok()).toBe(true);
  const { merchants } = (await response.json()) as {
    merchants: MerchantRecord[];
  };
  return merchants.filter((row) => row.canonical_name === merchant);
}

const test = base.extend<{
  receipt: { merchant: string; contentHash: string };
}>({
  receipt: [
    async ({ page }, use) => {
      // Browsers, retries and repeated runs share a user and database, but
      // must each exercise a fresh save and merchant confirmation.
      const contentHash = randomBytes(32).toString('hex');
      const merchant = `Mercadona E2E ${contentHash}`;
      await use({ merchant, contentHash });

      // Teardown has its own budget, including after a failed or timed-out test.
      try {
        const entries = await receiptEntries(page, merchant);
        if (entries.totalItems > 0) {
          await page.goto(
            `/records?${new URLSearchParams({ que: merchant, accion: 'todos' })}`,
          );
          for (const entry of entries.data) {
            await page
              .getByRole('button', {
                name: `Eliminar entrada ${entry.id}`,
                exact: true,
              })
              .click();
          }
          await expect(async () => {
            expect((await receiptEntries(page, merchant)).totalItems).toBe(0);
          }).toPass({ timeout: 15000 });
        }
      } finally {
        for (const row of await receiptMerchants(page, merchant)) {
          const deleted = await page.request.delete(
            `/api/merchants?${new URLSearchParams({ id: row.id })}`,
          );
          expect(deleted.ok()).toBe(true);
        }
        expect(await receiptMerchants(page, merchant)).toEqual([]);
      }
    },
    { timeout: 30000 },
  ],
});

test.describe('Receipt upload', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('prefills the form, and a correction is what gets remembered', async ({
    page,
    receipt,
  }) => {
    expect((await receiptEntries(page, receipt.merchant)).totalItems).toBe(0);
    expect(await receiptMerchants(page, receipt.merchant)).toEqual([]);

    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          ...CANNED_PARSE,
          parsedData: { ...CANNED_PARSE.parsedData, que: receipt.merchant },
          receipt: {
            ...CANNED_PARSE.receipt,
            contentHash: receipt.contentHash,
            comercio: receipt.merchant,
          },
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

    // `Qué` is already the unique merchant from the prefill, so there is nothing
    // to re-select: the point of the test is which category gets remembered.

    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.waitForURL(/\/records/, { timeout: 30000 });

    const saved = await receiptEntries(page, receipt.merchant);
    expect(saved.totalItems).toBe(1);
    expect(saved.data).toHaveLength(1);
    expect(saved.data[0]).toMatchObject({
      que: receipt.merchant,
      tipo: 'Limpieza',
    });
    expect(Number(saved.data[0].cantidad)).toBe(43.2);

    const learned = await receiptMerchants(page, receipt.merchant);
    expect(learned).toHaveLength(1);
    expect(learned[0]).toMatchObject({
      tipo: 'Limpieza',
      veces_confirmado: 1,
      veces_corregido: 0,
    });

    // Learned merchants are listed on the profile page.
    await page.goto('/user');

    // The remembered category is the saved one, not the prefill. The merchant
    // did not exist before this save, so `applyMerchantConfirmation` inserts
    // it with veces_confirmado = 1 and veces_corregido = 0 — the category the
    // user typed is what the memory holds.
    const row = page
      .getByRole('listitem')
      .filter({ hasText: receipt.merchant });
    await expect(row).toContainText('Limpieza');
    await expect(row).not.toContainText('Supermercado');
    await expect(row).toContainText('1 confirmada');
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
