import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let url: string;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve("e2e/fixtures"),
    server: { host: "127.0.0.1", port: 0, fs: { allow: [process.cwd()] } },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("No fixture server");
  url = `http://127.0.0.1:${address.port}/keyboard-scoresheet.html`;
});
test.afterAll(async () => {
  await server?.close();
});
test("undo cancels removed-event editing; switching teams edits instead of appending", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await page.getByRole("button", { name: "Editar lançamento 1", exact: true }).click();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Editar lançamento/ })).toHaveCount(0);
  await expect(page.getByLabel("Camisa, B ou C", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await page.getByRole("button", { name: "Editar lançamento 1", exact: true }).click();
  await page.getByRole("button", { name: "Equipe B · Equipe Verde", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Editar lançamento/ })).toBeVisible();
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Enter");
  await page.locator(".keyboard-entry input").nth(1).press("Enter");
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
  await expect(page.locator(".keyboard-history li").first()).toContainText("Equipe Verde");
});
test("setup validation gives a readable linked error and focuses jersey", async ({ page }) => {
  await page.goto(`${url}?setup`);
  await page.getByLabel("Camisa de Ana", { exact: true }).fill("");
  await page.getByRole("button", { name: "Iniciar transcrição" }).click();
  await expect(page.getByRole("alert")).toContainText("Confira as camisas");
  await expect(page.getByLabel("Camisa de Ana", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Camisa de Ana", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
async function entry(page: import("@playwright/test").Page, target: string, code: string) {
  const jersey = page.getByLabel("Camisa, B ou C", { exact: true });
  await jersey.fill(target);
  await jersey.press("Enter");
  const action = page.locator(".keyboard-entry input").nth(1);
  await expect(action).toBeFocused();
  await action.fill(code);
  await action.press("Enter");
  await expect(jersey).toBeFocused();
}
test("continuous two-field typing, team validation, modes, compensation, undo and edit", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("\\");
  await entry(page, "12", "2");
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Space");
  await entry(page, "12", "Uc");
  await expect(page.locator(".keyboard-history li").last()).toContainText("UC");
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Control+z");
  await expect(page.locator(".keyboard-history li")).toHaveCount(2);
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Control+Shift+z");
  await expect(page.locator(".keyboard-history li")).toHaveCount(3);
  await page.getByRole("button", { name: "Editar lançamento 1", exact: true }).click();
  await page.getByLabel("Período ativo").selectOption("2");
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Enter");
  await page.locator(".keyboard-entry input").nth(1).fill("2");
  await page.locator(".keyboard-entry input").nth(1).press("Enter");
  await expect(page.locator(".keyboard-history li").first()).toHaveClass(/period-blue/);
  await expect(page.locator(".keyboard-history li").first()).toContainText("Q2");
  await entry(page, "C", "C1");
  await expect(page.locator(".keyboard-history li").last()).toContainText("Técnico");
  await page.getByLabel("Camisa, B ou C", { exact: true }).fill("99");
  await page.getByLabel("Camisa, B ou C", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("não relacionada");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("server draft restores after reload and final correction remains explicit", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await expect(page.getByRole("status")).toHaveText("Rascunho salvo no servidor");
  await page.reload();
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
  await page.getByRole("button", { name: "Revisar totais e confirmar" }).click();
  await expect(page.getByRole("status")).toContainText("Súmula confirmada");
  await expect(page.getByLabel("Motivo da correção")).toBeVisible();
});
test("network failure preserves editable history and local recovery", async ({ page }) => {
  await page.goto(`${url}?fail`);
  await entry(page, "12", "3");
  await expect(page.getByRole("alert")).toContainText("Falha de rede");
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Recuperação" })).toBeVisible();
  await page.getByRole("button", { name: "Recuperar cópia local" }).click();
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
});
for (const width of [390, 720, 1440])
  test(`keyboard screen reflows at ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await entry(page, "12", "3");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
        document.documentElement.style.background = t === "dark" ? "#111827" : "#ffffff";
        document.documentElement.style.color = t === "dark" ? "#f9fafb" : "#111827";
      }, theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });
