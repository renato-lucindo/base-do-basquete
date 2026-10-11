import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let fixtureUrl: string;
const draftKey = "base-do-basquete:admin-draft:v1:manual-scoresheet:100:new:v3-setup";
const secondDraftKey = "base-do-basquete:admin-draft:v1:manual-scoresheet:200:new:v3-setup";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve("e2e/fixtures"),
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [process.cwd()] } },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
  fixtureUrl = `http://127.0.0.1:${address.port}/manual-scoresheet-setup.html`;
});

test.afterAll(async () => {
  await server?.close();
});

async function chooseGame(page: import("@playwright/test").Page) {
  const gameTeams = page.locator(".scoresheet-header-grid select");
  await gameTeams.nth(0).selectOption("10");
  await gameTeams.nth(1).selectOption("20");
  await page.getByLabel("Data do jogo (obrigatória)").fill("2026-10-15");
}

test("protects a stored draft until explicit restore or discard", async ({ page }) => {
  await page.goto(fixtureUrl);
  await chooseGame(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .not.toBeNull();
  const original = await page.evaluate((key) => localStorage.getItem(key), draftKey);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Rascunho recuperável" })).toBeVisible();
  await expect(page.locator(".scoresheet-form")).toHaveAttribute("inert", "");
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveValue("");
  await page.waitForTimeout(650);
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(original);
  await page.getByRole("button", { name: "Restaurar" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Jogo", exact: true })).toBeFocused();
  await expect(page.locator(".scoresheet-form")).not.toHaveAttribute("inert");
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveValue("2026-10-15");
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(original);
  await page.reload();
  await page.getByRole("button", { name: "Descartar" }).press("Space");
  await expect(page.getByRole("heading", { name: "Jogo", exact: true })).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
  await expect(page.locator(".scoresheet-form")).not.toHaveAttribute("inert");
});

test("focuses validation errors and identifies every starter and captain control", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await page.getByRole("button", { name: "Continuar para equipes" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveAttribute(
    "aria-describedby",
    "setup-game-date-error",
  );
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#setup-game-date-error")).toContainText("data de jogo válida");
  await chooseGame(page);
  await page.getByRole("button", { name: "Continuar para equipes" }).click();
  await expect(page.getByRole("heading", { name: "Equipes", exact: true })).toBeFocused();
  await expect(
    page.getByRole("radio", { name: "Capitão — Mandante, slot 1", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("radio", { name: "Capitão — Visitante, slot 1", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Titular — Mandante, slot 1", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Titular — Visitante, slot 1", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Continuar para lançamentos" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  const homeAthlete = page
    .locator("fieldset.lineup-panel")
    .nth(0)
    .getByRole("combobox", { name: /Atleta.*slot 1$/ });
  await expect(homeAthlete).not.toHaveAttribute("aria-invalid", "true");
  const homeCaptain = page.getByRole("radio", {
    name: "Capitão — Mandante, slot 1",
    exact: true,
  });
  await expect(homeCaptain).toHaveAttribute("aria-invalid", "true");
  await expect(homeCaptain).toHaveAttribute("aria-describedby", "setup-home-lineup-error");
  await expect(page.locator("#setup-home-lineup-error")).toContainText("capitão");
  const teams = page.locator("fieldset.lineup-panel");
  await teams
    .nth(0)
    .getByRole("combobox", { name: /Atleta.*slot 1$/ })
    .selectOption("1");
  await teams
    .nth(1)
    .getByRole("combobox", { name: /Atleta.*slot 1$/ })
    .selectOption("3");
  await page.getByRole("radio", { name: "Capitão — Mandante, slot 1", exact: true }).check();
  await page.getByRole("radio", { name: "Capitão — Visitante, slot 1", exact: true }).check();
  const coach = teams.nth(0).getByRole("textbox", { name: "Técnico" });
  await coach.pressSequentially("Ana Silva");
  await expect(coach).toHaveValue("Ana Silva");
  await page.getByRole("button", { name: "Continuar para lançamentos" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Configuração válida" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("isolates competition state and flushes edits during internal navigation", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await chooseGame(page);
  await page.getByLabel("Local (opcional)").fill("Ginásio da competição 100");
  await page.getByRole("link", { name: "Competição 200" }).click();
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveValue("");
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toContain(
    "Ginásio da competição 100",
  );
  await chooseGame(page);
  await page.getByLabel("Local (opcional)").fill("Ginásio da competição 200");
  await page.getByRole("link", { name: "Sair da configuração" }).click();
  await expect(page.getByText("Outra tela")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), secondDraftKey)).toContain(
    "Ginásio da competição 200",
  );
  await page.getByRole("link", { name: "Voltar à competição 100" }).click();
  await expect(page.getByRole("complementary", { name: "Rascunho recuperável" })).toBeVisible();
  await expect(page.getByLabel("Data do jogo (obrigatória)")).toHaveValue("");
  await page.getByRole("button", { name: "Restaurar" }).press("Enter");
  await expect(page.getByLabel("Local (opcional)")).toHaveValue("Ginásio da competição 100");
  await expect(page.getByRole("heading", { name: "Jogo", exact: true })).toBeFocused();
});

for (const width of [320, 390, 720, 1280]) {
  test(`wizard reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(fixtureUrl);
    await chooseGame(page);
    await page.getByRole("button", { name: "Continuar para equipes" }).click();
    const dimension = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimension.pageWidth).toBeLessThanOrEqual(dimension.viewportWidth);
  });
}

async function enterScoring(page: import("@playwright/test").Page) {
  await chooseGame(page);
  await page.getByRole("button", { name: "Continuar para equipes" }).click();
  const teams = page.locator("fieldset.lineup-panel");
  await teams
    .nth(0)
    .getByRole("combobox", { name: /Atleta.*slot 1$/ })
    .selectOption("1");
  await teams
    .nth(1)
    .getByRole("combobox", { name: /Atleta.*slot 1$/ })
    .selectOption("3");
  await teams
    .nth(0)
    .getByRole("combobox", { name: /Atleta.*slot 2$/ })
    .selectOption("4");
  await teams
    .nth(0)
    .getByRole("combobox", { name: /Atleta.*slot 3$/ })
    .selectOption("5");
  await page.getByRole("radio", { name: "Capitão — Mandante, slot 1", exact: true }).check();
  await page.getByRole("radio", { name: "Capitão — Visitante, slot 1", exact: true }).check();
  await page.getByRole("button", { name: "Continuar para lançamentos" }).click();
  await expect(page.getByRole("heading", { name: "Lançamentos", exact: true })).toBeVisible();
}

test("keyboard scoring supports 12 Enter 2 Enter, literal 00, errors, Escape, undo and grid correction", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.focus();
  await jersey.fill("12");
  await jersey.press("Enter");
  const points = page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" });
  await expect(points).toBeFocused();
  await points.fill("4");
  await points.press("Enter");
  await expect(page.locator("#fast-scoring-error")).toContainText("Valor inválido");
  await points.fill("2");
  await points.press("Enter");
  await expect(jersey).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Camisa 12: +2" })).toBeVisible();
  const twoPoints = page.getByRole("textbox", { name: "2P de Davi Atleta" });
  await expect(twoPoints).toHaveValue("1");
  await jersey.fill("00");
  await jersey.press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Pontos da camisa 00 (1, 2 ou 3)" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(jersey).toBeFocused();
  await jersey.fill("00");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 00 (1, 2 ou 3)" }).fill("3");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "3P de Eva Atleta" })).toHaveValue("1");
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("textbox", { name: "3P de Eva Atleta" })).toHaveValue("0");
  await expect(twoPoints).toHaveValue("1");
  await twoPoints.fill("3");
  await expect(twoPoints).toHaveValue("3");
  await expect(page.getByRole("button", { name: /Desfazer último/ })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("saves scoring stats in a local draft and restores them on reload", async ({ page }) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "LL de Davi Atleta" })).toHaveValue("1");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"home-3-1-free":"1"');
  await page.reload();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByRole("heading", { name: "Lançamentos", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "LL de Davi Atleta" })).toHaveValue("1");
  await expect(page.getByText("Nenhum lançamento nesta sessão.")).toBeVisible();
});

test("switches visitor and period with keyboard and keeps the scoring view within 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const team = page.getByRole("combobox", { name: "Equipe para lançamento rápido" });
  await team.selectOption("away");
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  await period.selectOption("2");
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("9");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 9 (1, 2 ou 3)" }).fill("1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "LL de Carla Atleta" })).toHaveValue("1");
  await expect(page.locator('input[name="stat-away-1-1-free"]')).toHaveCount(0);
  const dimension = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimension.pageWidth).toBeLessThanOrEqual(dimension.viewportWidth);
});
