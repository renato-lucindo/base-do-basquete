import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicStatisticsPath =
  "/2026/copa-es-ouro/fixture-fiba/masculino/jogadores?scope=all&mode=total";

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

test("public statistics have no serious axe violations and reflow at 200 percent", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PUBLIC_STATS !== "true",
    "The published statistics fixture is available only in the preview environment.",
  );

  // 720 CSS pixels represent a 1440-pixel desktop viewport at 200% browser zoom.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto(publicStatisticsPath);

  await expect(
    page.getByRole("region", { name: "Estatísticas dos jogadores", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Tabela de estatísticas dos jogadores" }),
  ).toBeVisible();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousOrCritical).toEqual([]);
});

test("public statistics mobile navigation is keyboard accessible without page overflow", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PUBLIC_STATS !== "true",
    "The published statistics fixture is available only in the preview environment.",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(publicStatisticsPath);

  const navigation = page.getByRole("navigation", { name: "Navegação da edição" });
  await expect(navigation.getByRole("link", { name: "Classificação" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Jogos" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Equipes" })).toBeVisible();

  const editionSwitcher = navigation.locator('summary[aria-label="Alterar edição"]');
  await editionSwitcher.focus();
  await expect(editionSwitcher).toBeFocused();
  await editionSwitcher.press("Enter");
  await expect(navigation.getByRole("combobox", { name: "Competição" })).toBeVisible();
  await editionSwitcher.press("Enter");
  await expect(navigation.getByRole("combobox", { name: "Competição" })).toBeHidden();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});
