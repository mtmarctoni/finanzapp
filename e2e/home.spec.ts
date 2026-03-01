import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./utils/auth";

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test("should load the home page with finance table", async ({ page }) => {
    await page.goto("/records");

    await expect(page).toHaveTitle(/Finanzas Personales/);
    await expect(
      page.getByRole("heading", { name: "Registros" }),
    ).toBeVisible();

    await expect(
      page.getByPlaceholder("Buscar por descripción o plataforma..."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Aplicar filtros" }),
    ).toBeVisible();

    await expect(
      page.getByRole("columnheader", { name: "Fecha" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Accion" }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Qué" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Tipo" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Cantidad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Acciones" }),
    ).toBeVisible();
  });

  test("should filter entries by search term", async ({ page }) => {
    await page.goto("/records");

    await page
      .getByPlaceholder("Buscar por descripción o plataforma...")
      .fill("test search");

    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).toHaveURL(/.*search=test(\+|%20)search.*/);
    await page.waitForLoadState("networkidle");
  });

  test("should filter entries by type", async ({ page }) => {
    await page.goto("/records");

    await page.getByRole("combobox").nth(0).click();

    await page.getByRole("option", { name: "Ingresos" }).click();

    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).toHaveURL(/.*accion=Ingreso.*/);
    await page.waitForLoadState("networkidle");
  });

  test("should reset filters when clear button is clicked", async ({
    page,
  }) => {
    await page.goto("/records?search=test&accion=Ingreso");

    await expect(
      page.getByPlaceholder("Buscar por descripción o plataforma..."),
    ).toHaveValue("test");

    await page.getByRole("button", { name: "Limpiar" }).click();

    await expect(page).toHaveURL(/\/records\?page=1$/);

    await expect(
      page.getByPlaceholder("Buscar por descripción o plataforma..."),
    ).toHaveValue("");
  });
});
