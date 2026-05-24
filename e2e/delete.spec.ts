import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './utils/auth';

test.describe('Delete Finance Entries', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should delete an entry with optimistic UI update', async ({ page }) => {
    await page.goto('/records');
    await page.waitForLoadState('networkidle');

    const deleteButton = page
      .getByRole('button', { name: /Eliminar entrada/ })
      .first();
    await deleteButton.waitFor({ state: 'attached', timeout: 10000 });

    const initialDeleteCount = await page
      .getByRole('button', { name: /Eliminar entrada/ })
      .count();

    await deleteButton.click();

    // Wait for server action + revalidation to settle
    await page.waitForLoadState('networkidle');

    await expect(async () => {
      const newDeleteCount = await page
        .getByRole('button', { name: /Eliminar entrada/ })
        .count();
      expect(newDeleteCount).toBeLessThan(initialDeleteCount);
    }).toPass({ timeout: 15000 });
  });
});
