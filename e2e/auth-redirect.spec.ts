import { test, expect } from '@playwright/test';

test('signed-out home visits finish the dashboard redirect before starting login', async ({
  page,
}) => {
  await page.route('**/api/auth/session', async (route) =>
    route.fulfill({ json: {} }),
  );
  const providersRequest = page.waitForRequest('**/api/auth/providers');
  await page.goto('/');
  // Starting this request on `/` races the server redirect and can take the
  // user to an auth error instead of sign-in, especially on Firefox/WebKit.
  const providers = await providersRequest;
  expect(new URL(providers.headers().referer).pathname).toBe('/dashboard');
  await expect(page).toHaveURL(/\/auth\/signin(?:\?|$)/);
  await expect(
    page.getByRole('button', { name: 'Continuar con GitHub' }),
  ).toBeVisible();
});
