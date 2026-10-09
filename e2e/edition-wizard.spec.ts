import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
let server: ViteDevServer;
let fixtureUrl: string;
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve("e2e/fixtures"),
    server: { host: "127.0.0.1", port: 0, fs: { allow: [process.cwd()] } },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
  fixtureUrl = `http://127.0.0.1:${address.port}/edition-wizard.html`;
});
test.afterAll(async () => {
  await server?.close();
});
test("Adulto, Base and Master use native accessible controls", async ({ page }) => {
  await page.goto(fixtureUrl);
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue("adult");
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await expect(page.getByText("Nome da disputa: GREEN", { exact: true })).toBeVisible();
  await page.getByLabel("Categoria", { exact: true }).selectOption("base");
  await page.getByLabel("Idade da categoria").fill("17");
  await expect(page.getByText("Nome da disputa: GREEN - Sub-17", { exact: true })).toBeVisible();
  await page.getByLabel("Categoria", { exact: true }).selectOption("master");
  await expect(page.getByLabel("Idade mínima").locator("option")).toHaveCount(13);
  await page.getByLabel("Idade mínima").selectOption("55");
  await expect(page.getByText("Nome da disputa: GREEN - 55+", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("keyboard review, preserved values and programmatic validation", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByLabel("Categoria", { exact: true }).selectOption("base");
  await page.getByLabel("Idade da categoria").fill("24");
  await page.getByLabel("Naipe").selectOption("male");
  await page.getByRole("button", { name: "Continuar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('fieldset[data-step="2"]')).toBeFocused();
  await page.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await page.getByLabel("Formato", { exact: true }).selectOption("single_group");
  await page.getByLabel("Quantidade de equipes").fill("4");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Idade da categoria")).toHaveAttribute(
    "aria-describedby",
    "edition-error",
  );
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("GREEN");
  await page.getByLabel("Idade da categoria").fill("17");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByRole("heading", { name: "GREEN - Sub-17" })).toBeFocused();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Idade da categoria")).toHaveValue("17");
});
for (const width of [390, 720, 1440])
  test(`identification reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixtureUrl);
    await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Campeonato com nome extenso para verificar quebra de linha");
    await page.getByLabel("Categoria", { exact: true }).selectOption("master");
    await page.getByLabel("Idade mínima").selectOption("85");
    await page.getByText("Divisão competitiva (opcional)", { exact: true }).click();
    await page.getByLabel("Divisão", { exact: true }).selectOption("new");
    await page.getByLabel("Tipo", { exact: true }).fill("Conferência");
    await page.getByLabel("Valor", { exact: true }).fill("Norte");
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
test("addition inherits context and allows independent dates and divisions", async ({ page }) => {
  await page.goto(`${fixtureUrl}?add`);
  await expect(page.getByLabel("Ano", { exact: true })).toHaveValue("2026");
  await expect(page.getByLabel("Naipe")).toBeDisabled();
  await expect(page.getByLabel("Início (opcional)")).toHaveValue("2026-11-01");
  await page.getByLabel("Início (opcional)").fill("2026-12-01");
  await page.getByText("Divisão competitiva (opcional)", { exact: true }).click();
  await page.getByLabel("Divisão", { exact: true }).selectOption("existing");
  await page.getByLabel("Valor", { exact: true }).selectOption("4");
  await expect(page.getByText("Nome da disputa: RED - Série Ouro", { exact: true })).toBeVisible();
});

test("format errors identify the format and navigation does not refocus old errors", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByLabel("Naipe").selectOption("male");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await page.getByLabel("Quantidade de equipes").fill("4");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByLabel("Formato", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Formato", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "edition-error",
  );
  await expect(page.getByRole("alert")).toBeFocused();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.locator('fieldset[data-step="1"]')).toBeFocused();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator('fieldset[data-step="2"]')).toBeFocused();
});

test("invalid division fields are revealed and associated with their errors", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByLabel("Naipe").selectOption("male");
  const summary = page.getByText("Divisão competitiva (opcional)", { exact: true });
  await summary.click();
  await page.getByLabel("Divisão", { exact: true }).selectOption("new");
  await summary.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByLabel("Tipo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "edition-error",
  );
  await page.getByLabel("Tipo", { exact: true }).fill("Série");
  await summary.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByLabel("Valor", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Valor", { exact: true })).toHaveAttribute("aria-invalid", "true");
});
