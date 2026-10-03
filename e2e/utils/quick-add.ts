import { type Page } from '@playwright/test';

/** Opens the global quick-add sheet from whatever navigation is on screen. */
export async function openQuickAdd(page: Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Nuevo registro' }).first().click();
  await page.getByRole('dialog', { name: 'Nuevo registro' }).waitFor();
}

/** Opens the sheet and switches it to the receipt-photo panel. */
export async function openReceiptSheet(page: Page) {
  await openQuickAdd(page);
  await page.getByRole('button', { name: 'Foto de recibo' }).click();
}
