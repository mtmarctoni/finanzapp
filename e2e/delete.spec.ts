import { test, expect } from '@playwright/test';

test.describe('Delete Finance Entries', () => {
  test('should delete an entry with optimistic UI update', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
    
    // Wait for the table to load
    await page.waitForSelector('table');
    
    // Get the number of rows before deletion
    const initialRowCount = await page.locator('table tbody tr').count();
    
    // Skip the test if there are no entries
    if (initialRowCount === 0) {
      test.skip(true, 'No entries available to delete');
      return;
    }
    
    // Get the text of the first entry to verify it's removed
    const firstRowText = await page.locator('table tbody tr').first().textContent();
    
    // Click on the delete button for the first entry
    const deleteButtons = await page.getByRole('button').filter({ hasText: '' }).all();
    // We're looking for the delete button which typically has a trash icon
    // This might need adjustment based on your actual UI
    
    // Find the delete button (usually the second button in each row)
    await deleteButtons[1].click();
    
    // Wait for the optimistic UI update
    await page.waitForTimeout(500);
    
    // Verify that the row count has decreased
    const newRowCount = await page.locator('table tbody tr').count();
    await expect(newRowCount).toBeLessThan(initialRowCount);
    
    // Verify that the deleted entry is no longer visible
    const pageContent = await page.textContent('body') || '';
    const entryRemoved = !pageContent.includes(firstRowText || '');
    await expect(entryRemoved).toBeTruthy();
  });
});
