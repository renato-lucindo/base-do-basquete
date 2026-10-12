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
  await expect(page.getByRole("heading", { name: "Lançamentos", exact: true })).toBeFocused();
}

test("review confirmation preserves the draft on failure and clears it only after successful retry", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  await page.getByRole("button", { name: "Voltar para equipes" }).click();
  const teams = page.locator("fieldset.lineup-panel");
  await teams.nth(0).getByRole("textbox", { name: "Técnico" }).fill("Técnico Azul");
  await teams.nth(1).getByRole("textbox", { name: "Técnico" }).fill("Técnico Vermelho");
  await page.getByRole("button", { name: "Continuar para lançamentos" }).click();
  await page.getByRole("textbox", { name: "2P de Ana Atleta" }).fill("1");
  await page.getByRole("button", { name: "Revisar e confirmar" }).click();
  await expect(page.getByRole("heading", { name: "Revisão final" })).toBeFocused();
  await expect(
    page.getByRole("table", { name: "Parciais por período e placar acumulado" }),
  ).toBeVisible();
  await expect(page.getByText("Técnico: Técnico Azul")).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("fixture-fail-confirm", "1"));
  await page.getByRole("button", { name: "Confirmar e gravar súmula" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha de gravação simulada");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .not.toBeNull();
  await page.evaluate(() => sessionStorage.removeItem("fixture-fail-confirm"));
  await page.getByRole("button", { name: "Confirmar e gravar súmula" }).click();
  await expect(page.getByText("Súmula confirmada e gravada. Jogo #42.")).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
  const keys = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("fixture-submission-keys") ?? "[]") as string[],
  );
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

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
  await expect(page.getByRole("heading", { name: "Lançamentos", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "LL de Davi Atleta" })).toHaveValue("1");
  await expect(page.getByText("Nenhum lançamento nesta sessão.")).toBeVisible();
});

test("records FIBA 2024 fouls, announces GD, blocks later fouls and keeps same-period scoring", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await foul.fill("12t");
  await foul.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "T registrada" })).toBeVisible();
  await expect(foul).toBeFocused();
  await foul.fill("12 u2");
  await foul.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "GD T+U" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "GD T+U" })).toBeVisible();
  await foul.fill("12P");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("GD");
  await foul.fill("00P");
  await foul.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Camisa 00: P registrada" }),
  ).toBeVisible();
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("2");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toHaveValue("1");
  await page.getByRole("combobox", { name: "Período para lançamento rápido" }).selectOption("2");
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("1");
  await page.keyboard.press("Enter");
  await expect(page.locator("#fast-scoring-error")).toContainText("pontos posteriores bloqueados");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("rejects retroactive GD when a later quarter already contains points", async ({ page }) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  await period.selectOption("3");
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("2");
  await page.keyboard.press("Enter");
  await period.selectOption("2");
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await foul.fill("12D");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("GD retroativa");
  await expect(foul).toHaveValue("12D");
  await expect(page.getByText("Faltas registradas: 0")).toBeVisible();
});

test("repairs invalid legacy foul cells in the grid and resumes FIBA entry", async ({ page }) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const legacy = page.getByRole("textbox", { name: "Faltas legadas de Davi Atleta em Q1" });
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await legacy.fill("T,?");
  await expect(legacy).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Revise os códigos legados, separados por vírgula")).toBeVisible();
  await foul.fill("12P");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("legadas incompletas");

  await legacy.fill("T");
  await expect(legacy).not.toHaveAttribute("aria-invalid", "true");
  await foul.fill("12U2");
  await foul.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "GD T+U" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("accepts a backdated foul before GD and blocks a same-period foul after GD", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await period.selectOption("3");
  await foul.fill("12D");
  await foul.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "GD D" })).toBeVisible();
  await period.selectOption("2");
  await foul.fill("12P");
  await foul.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "P registrada" })).toBeVisible();
  await period.selectOption("3");
  await foul.fill("12P");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("posteriores");
});

test("persists bench and coach fouls without a player and restores semantic draft", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const target = page.getByRole("combobox", { name: "Alvo da falta" });
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await target.selectOption("bench");
  await foul.fill("c1");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("Use B1");
  await foul.fill("b1");
  await foul.press("Enter");
  await target.selectOption("coach");
  await foul.fill("C1");
  await foul.press("Enter");
  await expect(page.getByText("Faltas registradas: 2")).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"kind":"bench"');
  await page.reload();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Faltas registradas: 2")).toBeVisible();
  await expect(page.getByRole("list", { name: "Faltas semânticas registradas" })).toContainText(
    "técnico: C1",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("unlocks OT only on cumulative ties and preserves OT drafts after corrections", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await page.getByRole("textbox", { name: "2P de Davi Atleta" }).fill("1");
  await period.selectOption("4");
  const q4Complete = page.getByRole("checkbox", { name: "Q4 concluído", exact: true });
  await q4Complete.check();
  await expect(page.getByRole("button", { name: "Adicionar OT1", exact: true })).toBeDisabled();
  await expect(period.locator("option")).toHaveCount(4);
  await page.getByRole("textbox", { name: "2P de Carla Atleta" }).fill("1");
  await page.getByRole("textbox", { name: "LL de Davi Atleta" }).fill("?");
  await expect(page.getByRole("button", { name: "Adicionar OT1", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "LL de Davi Atleta" }).fill("");
  await expect(q4Complete).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Adicionar OT1", exact: true })).toBeDisabled();
  await q4Complete.press("Space");
  // Adding OT also cancels an unfinished keyboard entry and focuses the selector.
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("button", { name: "Adicionar OT1", exact: true }).press("Enter");
  await expect(period).toHaveValue("5");
  await expect(period).toBeFocused();
  await expect(jersey).toHaveValue("");
  await expect(jersey).toBeEnabled();
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("3");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Adicionar OT2", exact: true })).toBeDisabled();
  const row = page.getByRole("row").filter({ hasText: "Davi Atleta" });
  await expect(row.getByRole("cell", { name: "5", exact: true })).toBeVisible();
  await jersey.press("Control+z");
  await expect(page.getByRole("textbox", { name: "3P de Davi Atleta" })).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Adicionar OT2", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "OT1 concluído", exact: true }).check();
  await expect(page.getByRole("button", { name: "Adicionar OT2", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "3P de Davi Atleta" }).fill("1");
  await page.getByRole("textbox", { name: "3P de Carla Atleta" }).fill("1");
  await expect(
    page.getByRole("checkbox", { name: "OT1 concluído", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: "OT1 concluído", exact: true }).check();
  await page.getByRole("button", { name: "Adicionar OT2", exact: true }).press("Space");
  await expect(period).toHaveValue("6");
  await expect(period).toBeFocused();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"periodCount":6');
  await page.reload();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(period.locator("option")).toHaveCount(6);
  await period.selectOption("5");
  await expect(page.getByRole("textbox", { name: "3P de Davi Atleta" })).toHaveValue("1");
  await period.selectOption("1");
  await page.getByRole("textbox", { name: "2P de Davi Atleta" }).fill("2");
  await expect(page.getByRole("button", { name: "Adicionar OT3", exact: true })).toBeDisabled();
  await expect(page.locator("#fast-overtime-help")).toContainText("preservados");
  await period.selectOption("5");
  await expect(page.getByRole("textbox", { name: "3P de Davi Atleta" })).toHaveValue("1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("shares Q4/OT fouls and permits grouped GD scoring while blocking later fouls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await period.selectOption("4");
  await page.getByRole("textbox", { name: "2P de Davi Atleta" }).fill("1");
  await page.getByRole("textbox", { name: "2P de Carla Atleta" }).fill("1");
  await page.getByRole("textbox", { name: "Faltas legadas de Davi Atleta em Q4/OT" }).fill("U2");
  await page.getByRole("checkbox", { name: "Q4 concluído", exact: true }).check();
  await page.getByRole("button", { name: "Adicionar OT1", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Faltas legadas de Davi Atleta em Q4/OT" }),
  ).toHaveValue("U2");
  await foul.fill("12T1");
  await foul.press("Enter");
  await expect(page.getByRole("cell", { name: "GD T+U" })).toBeVisible();
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("2");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toHaveValue("1");
  await foul.fill("12P");
  await foul.press("Enter");
  await expect(page.locator("#fast-foul-error")).toContainText("GD");
  await period.selectOption("4");
  await expect(
    page.locator('output[aria-label="Faltas rápidas de Davi Atleta em Q4/OT"]'),
  ).toHaveText("T1");
  await expect(page.getByText("Faltas registradas: 1")).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"periodNumber":4');
  await page.reload();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await period.selectOption("5");
  await expect(page.getByRole("cell", { name: "GD T+U" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toHaveValue("1");
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toBeEnabled();
  await page.getByRole("combobox", { name: "Alvo da falta" }).selectOption("coach");
  await foul.fill("C1");
  await foul.press("Enter");
  await expect(page.getByText("Faltas registradas: 2")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const dimension = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimension.width).toBeLessThanOrEqual(dimension.viewport);
});

test("blocks OT points after early GD and requires completion for every OT up to OT8", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  await period.selectOption("3");
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await foul.fill("12D");
  await foul.press("Enter");
  await period.selectOption("4");
  await page.getByRole("textbox", { name: "2P de Ana Atleta" }).fill("1");
  await page.getByRole("textbox", { name: "2P de Carla Atleta" }).fill("1");
  await page.getByRole("checkbox", { name: "Q4 concluído", exact: true }).check();
  await page.getByRole("button", { name: "Adicionar OT1", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toBeDisabled();
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("12");
  await jersey.press("Enter");
  await page.getByRole("textbox", { name: "Pontos da camisa 12 (1, 2 ou 3)" }).fill("2");
  await page.keyboard.press("Enter");
  await expect(page.locator("#fast-scoring-error")).toContainText("pontos posteriores bloqueados");
  for (let ot = 1; ot < 8; ot += 1) {
    await expect(
      page.getByRole("button", { name: `Adicionar OT${ot + 1}`, exact: true }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: `OT${ot} concluído`, exact: true }).check();
    await page.getByRole("button", { name: `Adicionar OT${ot + 1}`, exact: true }).click();
    await expect(period).toHaveValue(String(ot + 5));
  }
  await page.getByRole("checkbox", { name: "OT8 concluído", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Limite de OT atingido", exact: true }),
  ).toBeDisabled();
  await expect(period.locator("option")).toHaveCount(12);
});

test("rejects legacy GD conflicting with later points and restores all accepted data", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  await period.selectOption("3");
  await page.getByRole("textbox", { name: "2P de Davi Atleta" }).fill("1");
  await period.selectOption("2");
  const legacy = page.getByRole("textbox", { name: "Faltas legadas de Davi Atleta em Q2" });
  await legacy.fill("D");
  await expect(legacy).toHaveValue("");
  await expect(legacy).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("pontos registrados em período posterior");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"home-3-3-two":"1"');
  await page.reload();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await period.selectOption("3");
  await expect(page.getByRole("textbox", { name: "2P de Davi Atleta" })).toHaveValue("1");
  await page.getByRole("textbox", { name: "2P de Davi Atleta" }).fill("0");
  await period.selectOption("2");
  await legacy.fill("D");
  await expect(legacy).toHaveValue("D");
  await expect(legacy).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("cell", { name: "GD D" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("preserves an incompatible historical draft until explicit discard", async ({ page }) => {
  await page.goto(fixtureUrl);
  await enterScoring(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain('"step":3');
  const incompatible = await page.evaluate((key) => {
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.data.stats = { "home-3-2-fouls": "D", "home-3-3-two": "1" };
    const raw = JSON.stringify(draft);
    localStorage.setItem(key, raw);
    return raw;
  }, draftKey);
  await page.reload();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "O rascunho foi preservado" }),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Rascunho recuperável" })).toBeVisible();
  await expect(page.locator(".scoresheet-form")).toHaveAttribute("inert", "");
  await page.waitForTimeout(650);
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(incompatible);
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
});

test("switches visitor and period with keyboard and keeps the scoring view within 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixtureUrl);
  await enterScoring(page);
  const team = page.getByRole("combobox", { name: "Equipe para lançamento rápido" });
  const foul = page.getByRole("textbox", { name: "Código da falta" });
  await foul.fill("12U2");
  await team.focus();
  await team.selectOption("away");
  await expect(team).toBeFocused();
  await expect(foul).toHaveValue("");
  await foul.fill("9P");
  const period = page.getByRole("combobox", { name: "Período para lançamento rápido" });
  await period.focus();
  await period.selectOption("2");
  await expect(period).toBeFocused();
  await expect(foul).toHaveValue("");
  const jersey = page.getByRole("textbox", { name: "Número da camisa" });
  await jersey.fill("9");
  await jersey.press("Enter");
  await expect(page.getByRole("textbox", { name: "Pontos da camisa 9 (1, 2 ou 3)" })).toBeFocused();
  await period.focus();
  await period.selectOption("3");
  await expect(period).toBeFocused();
  await expect(jersey).toBeEnabled();
  await expect(jersey).toHaveValue("");
  await period.selectOption("2");
  await expect(period).toBeFocused();
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
