import { expect, test } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

test.describe('Analytics por Tipo', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('navigates via the subnav, scopes charts and table by tipo, sorts, paginates and survives a reload', async ({
    page,
  }) => {
    await page.goto('/analytics');

    await page.getByRole('link', { name: 'Por Tipo' }).click();
    await expect(page).toHaveURL(/\/analytics\/tipo$/);

    // The Tipo chip row selects a tipo and drives the ?type= query param.
    const viviendaRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/entries') &&
        request.url().includes('tipo=Vivienda'),
    );
    await page.getByRole('button', { name: 'Vivienda' }).first().click();
    await expect(page).toHaveURL(/type=Vivienda/);
    await viviendaRequest;

    // Cards and table are scoped to Vivienda.
    await expect(
      page.getByRole('heading', { name: 'Analíticas por Tipo' }),
    ).toBeVisible();
    await expect(
      page.getByText(/movimientos en Vivienda/).first(),
    ).toBeVisible();
    await expect(page.getByText('Movimientos por Tipo')).toBeVisible();

    // The summary cards carry a monthly average line.
    await expect(page.getByText(/\/mes$/).first()).toBeVisible();

    // Sorting by importe re-fetches with the sort params.
    let sortRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/entries') &&
        request.url().includes('sortBy=cantidad') &&
        request.url().includes('sortOrder=desc'),
    );
    await page.getByRole('button', { name: 'Ordenar por Importe' }).click();
    await sortRequest;

    sortRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/entries') &&
        request.url().includes('sortBy=cantidad') &&
        request.url().includes('sortOrder=asc'),
    );
    await page.getByRole('button', { name: 'Ordenar por Importe' }).click();
    await sortRequest;

    // The seeded data has more than one page of Vivienda movements.
    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    const nextPageRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/entries') &&
        request.url().includes('page=2'),
    );
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await nextPageRequest;
    await expect(page.getByText('Página 2 de 2')).toBeVisible();

    // A reload keeps the tipo-scoped state coming from the URL.
    await page.reload();
    await expect(page).toHaveURL(/type=Vivienda/);
    await expect(
      page.getByText(/movimientos en Vivienda/).first(),
    ).toBeVisible();
  });
});
