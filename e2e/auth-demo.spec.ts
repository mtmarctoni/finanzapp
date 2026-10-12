import { test, expect } from '@playwright/test';

test('eligible Preview demo keeps failed login inline, then authenticates to the callback', async ({
  page,
}) => {
  const metadata = await page.request.get('/api/auth/demo');
  const { demo } = await metadata.json();
  test.skip(
    !demo,
    'Requires eligible Preview configuration and a working test database',
  );

  await page.goto('/auth/signin?callbackUrl=/dashboard');
  const shortcut = page.getByRole('button', { name: 'Usar usuario de prueba' });
  await expect(shortcut).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toHaveValue('');
  // Activate the native button through the keyboard.
  await shortcut.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(
    'test@example.com',
  );
  await expect(page.getByLabel('Contraseña')).toHaveValue('password123');
  await expect(page).toHaveURL(/\/auth\/signin\?/);
  const before = await page.request.get('/api/auth/session');
  expect((await before.json()).user).toBeUndefined();

  await page.getByLabel('Contraseña').fill('incorrect-password');
  const rejectedLogin = page.waitForResponse(
    '**/api/auth/callback/credentials',
  );
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  const rejectedResponse = await rejectedLogin;
  expect(rejectedResponse.status()).toBe(401);
  expect((await rejectedResponse.json()).url).toContain(
    'error=CredentialsSignin',
  );
  const credentialError = page
    .getByRole('alert')
    .filter({ hasText: 'Credenciales inválidas' });
  await expect(credentialError).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=\/dashboard$/);
  await expect(page.getByLabel('Correo electrónico')).toHaveValue(
    'test@example.com',
  );
  await expect(page.getByLabel('Contraseña')).toHaveValue('incorrect-password');
  await expect(page.getByLabel('Contraseña')).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión', exact: true }),
  ).toBeEnabled();
  await expect(shortcut).toBeEnabled();
  const failedSession = await page.request.get('/api/auth/session');
  expect((await failedSession.json()).user).toBeUndefined();

  await shortcut.click();
  await expect(credentialError).toHaveCount(0);
  await expect(page.getByLabel('Contraseña')).toHaveValue('password123');
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await page.waitForURL(/\/dashboard$/, { waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => {
      const after = await page.request.get('/api/auth/session');
      return (await after.json()).user;
    })
    .toMatchObject({
      id: 'f7a8b9c0-1e2f-3d45-6a7b-1234567890cd',
      email: 'test@example.com',
    });
});
