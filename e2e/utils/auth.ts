import { expect, type Page } from "@playwright/test";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "password123";

export async function signInAsTestUser(page: Page) {
  await page.goto("/auth/signin");

  if (!page.url().includes("/auth/signin")) {
    return;
  }

  await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
  await page.getByLabel("Contraseña").fill(TEST_PASSWORD);
  await page
    .locator("form")
    .getByRole("button", { name: "Iniciar sesión" })
    .click();

  await expect(page).not.toHaveURL(/\/auth\/signin/);
  await expect(
    page.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
}
