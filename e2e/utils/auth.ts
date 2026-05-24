import { type Page } from '@playwright/test';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

export async function signInAsTestUser(page: Page) {
  const csrfResponse = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();

  await page.request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      callbackUrl: '/',
      json: 'true',
    },
  });
}
