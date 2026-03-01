import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./utils/auth";

test.describe("Delete Finance Entries", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test("should delete an entry with optimistic UI update", async ({ page }) => {
    await page.goto("/records");

    await page.waitForSelector("table");

    const initialRowCount = await page.locator("table tbody tr").count();

    if (initialRowCount === 0) {
      test.skip(true, "No entries available to delete");
      return;
    }

    const deleteButtonsCount = await page
      .getByRole("button", { name: /Eliminar entrada/ })
      .count();
    if (deleteButtonsCount === 0) {
      test.skip(true, "No entries available to delete");
      return;
    }

    await page
      .getByRole("button", { name: /Eliminar entrada/ })
      .first()
      .click();

    await page.waitForTimeout(500);

    const newRowCount = await page.locator("table tbody tr").count();
    await expect(newRowCount).toBeLessThan(initialRowCount);
  });
});
