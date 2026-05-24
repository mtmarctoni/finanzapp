import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './utils/auth';

test.describe('Delete Finance Entries', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('should delete an entry with optimistic UI update', async ({ page }) => {
    await page.goto('/records');

    const deleteButton = page
      .getByRole('button', { name: /Eliminar entrada/ })
      .first();
    await deleteButton.waitFor({ state: 'attached', timeout: 10000 });

    const initialRowCount = await page.locator('table tbody tr').count();

    await deleteButton.click();

    await expect(async () => {
      const newRowCount = await page.locator('table tbody tr').count();
      expect(newRowCount).toBeLessThan(initialRowCount);
    }).toPass({ timeout: 5000 });
  });
});
