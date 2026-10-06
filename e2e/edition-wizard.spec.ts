import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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

async function identifyNewEdition(page: Page) {
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

test("Adulto, Base and Master use native accessible controls", async ({ page }) => {
  await page.goto(fixtureUrl);
  await identifyNewEdition(page);
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveValue("adult");
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

test("multiple disputes preserve independent configuration in one review", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByLabel("Ordem da navegação").selectOption("division_category");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  const first = page.getByRole("group", { name: "Disputa 1" });
  await first.getByLabel("Naipe").selectOption("male");
  await first.getByLabel("Início (opcional)").fill("2026-03-01");
  await first.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await first.getByLabel("Formato", { exact: true }).selectOption("single_group");
  await first.getByLabel("Quantidade de equipes").fill("4");

  await page.getByRole("button", { name: "Adicionar outra disputa" }).click();
  const second = page.getByRole("group", { name: "Disputa 2" });
  await second.getByLabel("Categoria", { exact: true }).selectOption("base");
  await second.getByLabel("Idade da categoria").fill("17");
  await second.getByLabel("Naipe").selectOption("female");
  await second.getByLabel("Início (opcional)").fill("2026-04-01");
  await second.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await second.getByLabel("Formato", { exact: true }).selectOption("single_elimination");
  await second.getByLabel("Quantidade de equipes").fill("8");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByRole("heading", { name: "Revisão da criação" })).toBeFocused();
  await expect(page.getByText("GREEN - Sub-17", { exact: true })).toBeVisible();
  await expect(page.getByText("Navegação: Divisão → Categoria", { exact: true })).toBeVisible();
  await expect(page.getByText(/4 equipes ·/)).toBeVisible();
  await expect(page.getByText(/8 equipes ·/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("adding and removing disputes preserves keyboard focus", async ({ page }) => {
  await page.goto(fixtureUrl);
  await identifyNewEdition(page);
  const add = page.getByRole("button", { name: "Adicionar outra disputa" });
  await add.focus();
  await page.keyboard.press("Enter");
  const second = page.getByRole("group", { name: "Disputa 2" });
  await expect(second.getByLabel("Categoria", { exact: true })).toBeFocused();
  const remove = second.getByRole("button", { name: "Remover disputa 2" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("removing from the dispute limit focuses the reappearing add action", async ({ page }) => {
  await page.goto(fixtureUrl);
  await identifyNewEdition(page);
  const add = page.getByRole("button", { name: "Adicionar outra disputa" });
  for (let dispute = 2; dispute <= 12; dispute++) await add.click();
  await expect(add).toHaveCount(0);
  await page
    .getByRole("group", { name: "Disputa 12" })
    .getByRole("button", { name: "Remover disputa 12" })
    .click();
  await expect(add).toBeFocused();
});

for (const width of [390, 720, 1440])
  test(`adaptive edition table is accessible and contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${fixtureUrl}?table`);
    const table = page.getByRole("table", { name: "Copa Metropolitana · 2026" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveText([
      "Divisão",
      "Categoria",
      "Naipe",
      "Disputa",
      "Situação",
    ]);
    await expect(table.getByRole("row")).toHaveCount(3);
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

test("keyboard review, preserved values and programmatic validation", async ({ page }) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
  await page.getByLabel("Nome", { exact: true }).fill("GREEN");
  await page.getByRole("button", { name: "Continuar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('fieldset[data-step="2"]')).toBeFocused();
  await page.getByLabel("Categoria", { exact: true }).selectOption("base");
  await page.getByLabel("Idade da categoria").fill("24");
  await page.getByLabel("Naipe").selectOption("male");
  await page.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await page.getByLabel("Formato", { exact: true }).selectOption("single_group");
  await page.getByLabel("Quantidade de equipes").fill("4");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Idade da categoria")).toHaveAttribute(
    "aria-describedby",
    "edition-error",
  );
  await page.getByLabel("Idade da categoria").fill("17");
  await page.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByRole("heading", { name: "Revisão da criação" })).toBeFocused();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("GREEN");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel("Idade da categoria")).toHaveValue("17");
});

for (const width of [390, 720, 1440])
  test(`multi-dispute configuration reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(fixtureUrl);
    await page.getByLabel("Campeonato", { exact: true }).selectOption("new");
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Campeonato com nome extenso para verificar quebra de linha");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Categoria", { exact: true }).selectOption("master");
    await page.getByLabel("Idade mínima").selectOption("85");
    await page.getByLabel("Divisão competitiva").selectOption("new");
    await page.getByLabel("Tipo", { exact: true }).fill("Conferência");
    await page.getByLabel("Valor", { exact: true }).fill("Norte");
    await page.getByRole("button", { name: "Adicionar outra disputa" }).click();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

test("addition inherits edition context and chooses gender per dispute", async ({ page }) => {
  await page.goto(`${fixtureUrl}?add`);
  await expect(page.getByLabel("Ano", { exact: true })).toHaveValue("2026");
  await expect(page.getByLabel("Ordem da navegação")).toBeDisabled();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByLabel("Naipe")).toBeEnabled();
  await page.getByLabel("Naipe").selectOption("female");
  await expect(page.getByLabel("Início (opcional)")).toHaveValue("2026-11-01");
  await page.getByLabel("Início (opcional)").fill("2026-12-01");
  await page.getByLabel("Divisão competitiva").selectOption("existing");
  await page.getByLabel("Valor", { exact: true }).selectOption("4");
  await expect(page.getByText("Nome da disputa: RED - Série Ouro", { exact: true })).toBeVisible();
});

test("format errors identify the field and navigation does not refocus old errors", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await identifyNewEdition(page);
  await page.getByLabel("Naipe").selectOption("male");
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

test("invalid division fields are visible and associated with their errors", async ({ page }) => {
  await page.goto(fixtureUrl);
  await identifyNewEdition(page);
  await page.getByLabel("Naipe").selectOption("male");
  await page.getByLabel("Divisão competitiva").selectOption("new");
  await page.getByLabel("Fonte primária").selectOption("manual_scoresheet");
  await page.getByLabel("Formato", { exact: true }).selectOption("single_group");
  await page.getByLabel("Quantidade de equipes").fill("4");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByLabel("Tipo", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "edition-error",
  );
  await page.getByLabel("Tipo", { exact: true }).fill("Série");
  await page.getByRole("button", { name: "Revisar estrutura" }).click();
  await expect(page.getByLabel("Valor", { exact: true })).toHaveAttribute("aria-invalid", "true");
});
