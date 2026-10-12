import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let fixtureUrl: string;
const key = "base-do-basquete:admin-draft:v1:manual-scoresheet:100:42:v3-revision-80";
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: resolve("node_modules/.vite-scoresheet-revision"),
    root: resolve("e2e/fixtures"),
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [process.cwd()] } },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Fixture server unavailable");
  fixtureUrl = `http://127.0.0.1:${address.port}/manual-scoresheet-setup.html?revision=1`;
});
test.afterAll(async () => {
  await server?.close();
});
async function review(page: Page) {
  await page.getByRole("button", { name: "Continuar para equipes" }).click();
  await page.getByRole("button", { name: "Continuar para lançamentos" }).click();
  await page.getByRole("button", { name: "Revisar e confirmar" }).click();
}
test("requires reason and confirmation, exposes diff and supports keyboard retry", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  const teams = page.locator(".scoresheet-header-grid select");
  await expect(teams.nth(0)).toBeDisabled();
  await expect(teams.nth(1)).toBeDisabled();
  await page.getByLabel("Local (opcional)").fill("Novo ginásio");
  await review(page);
  await expect(page.getByRole("heading", { name: "Revisão final" })).toBeFocused();
  await expect(
    page
      .locator("section", { has: page.getByRole("heading", { name: "Alterações desta revisão" }) })
      .last(),
  ).toContainText("Ginásio original → Novo ginásio");
  await expect(page.getByText("Placar anterior: 2 × 0. Placar revisado: 2 × 0.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e gravar revisão" }).press("Enter");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Motivo da revisão (obrigatório)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("checkbox", { name: /Revisei as alterações/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("checkbox", { name: /Revisei as alterações/ })).toHaveAttribute(
    "aria-describedby",
    "revision-confirmation-error",
  );
  await page.getByLabel("Motivo da revisão (obrigatório)").fill("Corrigir o local da partida");
  await page.getByRole("checkbox", { name: /Revisei as alterações/ }).press("Space");
  await page.evaluate(() => sessionStorage.setItem("fixture-fail-confirm", "1"));
  await page.getByRole("button", { name: "Confirmar e gravar revisão" }).press("Enter");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("rascunho foi preservado");
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), key)).not.toBeNull();
  await page.evaluate(() => sessionStorage.removeItem("fixture-fail-confirm"));
  await page.getByRole("button", { name: "Confirmar e gravar revisão" }).press("Enter");
  await expect(page.getByText("Revisão gravada em uma nova versão. Jogo #42.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revisão final" })).toBeFocused();
  const keys = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("fixture-submission-keys") ?? "[]"),
  );
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("restores the reason and draft, requires new confirmation after editing, isolates bases", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await page.getByLabel("Local (opcional)").fill("Local recuperável");
  await review(page);
  await page.getByLabel("Motivo da revisão (obrigatório)").fill("Preservar correção em andamento");
  await page.getByRole("checkbox", { name: /Revisei as alterações/ }).check();
  await page.getByLabel("Motivo da revisão (obrigatório)").fill("Correção atualizada do local");
  await expect(page.getByRole("checkbox", { name: /Revisei as alterações/ })).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}").data?.revisionReason, key),
    )
    .toBe("Correção atualizada do local");
  await page.reload();
  await page.getByRole("button", { name: "Restaurar" }).press("Enter");
  await expect(page.getByLabel("Motivo da revisão (obrigatório)")).toHaveValue(
    "Correção atualizada do local",
  );
  await expect(page.getByRole("checkbox", { name: /Revisei as alterações/ })).not.toBeChecked();
  await page.getByRole("link", { name: "Versão atualizada" }).click();
  await expect(page.getByLabel("Local (opcional)")).toHaveValue("Ginásio original");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).not.toBeNull();
  await page.getByRole("link", { name: "Versão ativa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restaurar" })).toBeVisible();
});
test("renders an older immutable snapshot with names, scoring and no save controls", async ({
  page,
}) => {
  await page.goto(fixtureUrl);
  await page.getByRole("link", { name: "Consultar versão anterior" }).click();
  await expect(
    page.getByRole("heading", { name: "Versão anterior — somente consulta" }),
  ).toBeFocused();
  await expect(page.getByRole("region", { name: "Conteúdo da versão salva" })).toContainText(
    "Ana Atleta (capitão)",
  );
  await expect(page.getByText("2 × 0", { exact: true })).toBeVisible();
  await expect(page.getByText("Q4 · T1 · Ana Atleta (camisa 7) · Equipe Azul")).toBeVisible();
  await expect(page.getByRole("button", { name: /gravar/ })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Abrir versão ativa" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Revisar súmula do jogo #42" })).toBeFocused();
});
test("keeps the revision readable at narrow width and 200% text zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixtureUrl);
  await page.getByLabel("Local (opcional)").fill("Novo local com justificativa");
  await review(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(page.getByLabel("Motivo da revisão (obrigatório)")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
