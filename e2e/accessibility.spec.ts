import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrative login has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/admin/login");

  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
