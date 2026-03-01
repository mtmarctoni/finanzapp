import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./utils/auth";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test("should load the dashboard with summary statistics", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Panel de Control" }),
    ).toBeVisible();

    await expect(
      page.getByText("Total Ingresos", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Total Gastos", { exact: true })).toBeVisible();
    await expect(page.getByText("Balance", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Balance Final", { exact: true }),
    ).toBeVisible();

    await expect(page.getByText("Tendencias Mensuales")).toBeVisible();
  });

  test("should display charts with financial data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("canvas").first()).toBeVisible();
    await expect(page.getByText("Flujo mensual")).toBeVisible();

    await page.waitForTimeout(1000);
  });

  test("should navigate to records page", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Registros" }).click();

    await expect(page).toHaveURL("/records");
  });
});
