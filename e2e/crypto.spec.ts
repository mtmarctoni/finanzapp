import { test, expect, type Page } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

/**
 * A ticker no other test, browser or earlier run will have used, so the
 * holding it creates is this test's alone (crypto_symbol is VARCHAR(20)).
 */
function uniqueSymbol() {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 3).toString(36)}`;
  return `E2E${suffix}`.toUpperCase().slice(0, 20);
}

async function deleteTransactionsFor(page: Page, symbol: string) {
  const response = await page.request.get(
    `/api/crypto/transactions?cryptoSymbol=${encodeURIComponent(symbol)}`,
  );
  if (!response.ok()) return;
  const { data } = (await response.json()) as { data: { id: string }[] };
  for (const transaction of data) {
    await page.request.delete(`/api/crypto/transactions/${transaction.id}`);
  }
}

test.describe('Crypto Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should add a deposit and show it as a holding', async ({ page }) => {
    const symbol = uniqueSymbol();

    try {
      await page.goto('/investment/crypto');
      await expect(
        page.getByRole('heading', { name: 'Cripto', level: 1 }),
      ).toBeVisible();

      // The form loads its symbols and transaction types when it opens.
      await Promise.all([
        page.waitForResponse('/api/crypto/options'),
        page.getByRole('button', { name: 'Nueva', exact: true }).click(),
      ]);
      const dialog = page.getByRole('dialog', { name: 'Nueva transacción' });

      // A new transaction defaults to a deposit dated today. The symbol is
      // new, so pick the "Crear ..." option the combobox offers. Click it
      // rather than pressing Enter: the list is long and loads asynchronously,
      // and filling in one go leaves cmdk's first item unselected until after
      // a re-render, so Enter would race that render.
      await dialog.getByLabel('Criptomoneda', { exact: true }).click();
      await page.getByPlaceholder('Buscar...').last().fill(symbol);
      await page.getByRole('option', { name: `Crear "${symbol}"` }).click();
      await expect(
        dialog.getByLabel('Criptomoneda', { exact: true }),
      ).toHaveText(symbol);

      await dialog.getByLabel('Cantidad', { exact: true }).fill('0.5');
      await dialog.getByLabel('Precio por unidad (EUR)').fill('100');

      await dialog.getByRole('button', { name: 'Guardar' }).click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      // The saved deposit reaches the overview as a position in that symbol.
      const position = page
        .getByRole('listitem')
        .filter({ hasText: `0,5 ${symbol}` });
      await expect(position).toBeVisible({ timeout: 15000 });
    } finally {
      await deleteTransactionsFor(page, symbol);
    }
  });
});
