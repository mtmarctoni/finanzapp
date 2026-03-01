import { test, expect } from "@playwright/test";
import { format } from "date-fns";
import { signInAsTestUser } from "./utils/auth";

test.describe("Create and Edit Finance Entries", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test("should navigate to create page and create a new entry", async ({
    page,
  }) => {
    await page.goto("/records");

    await page.getByRole("link", { name: "Añadir Entrada" }).click();

    await expect(page).toHaveURL("/new");
    await expect(
      page.getByRole("heading", { name: "Añadir Nueva Entrada" }),
    ).toBeVisible();

    const today = format(new Date(), "yyyy-MM-dd");
    await page.getByLabel("Fecha").fill(today);
    await page.getByLabel("Hora").fill("10");
    await page.getByLabel("Minuto").fill("30");

    await page.getByText("Selecciona un tipo").click();
    await page.getByRole("option", { name: "Ingreso" }).click();

    await page.getByText("Seleccionar tipo...").click();
    await page.getByPlaceholder("Buscar...").last().fill("Tipo E2E");
    await page.keyboard.press("Enter");

    await page.getByText("Seleccionar qué...").click();
    await page.getByPlaceholder("Buscar...").last().fill("Que E2E");
    await page.keyboard.press("Enter");

    await page.getByText("Seleccionar plataforma...").click();
    await page.getByPlaceholder("Buscar...").last().fill("Plataforma E2E");
    await page.keyboard.press("Enter");

    await page.getByLabel("Cantidad").fill("1500");
    await page.getByLabel("Detalle 1").fill("Test detalle 1");
    await page.getByLabel("Detalle 2").fill("Test detalle 2");

    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page).toHaveURL("/records");
  });

  test("should edit an existing entry", async ({ page }) => {
    await page.goto("/records");

    await page.waitForSelector("table");

    const editButtonsCount = await page
      .getByRole("button", { name: /Editar entrada/ })
      .count();
    if (editButtonsCount > 0) {
      await page
        .getByRole("button", { name: /Editar entrada/ })
        .first()
        .click();

      await expect(page.url()).toContain("/edit/");

      await page.waitForSelector("form");

      await page.getByLabel("Cantidad").fill("2000");

      await page.getByRole("button", { name: "Actualizar" }).click();

      await expect(page).toHaveURL("/records");
    } else {
      test.skip(true, "No entries available to edit");
    }
  });
});
