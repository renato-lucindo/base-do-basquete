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
test("rejects clearing participation with events without unmounting the editor", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await page
    .getByText("Participação em quadra — conferir atletas sem pontos", {
      exact: true,
    })
    .click();
  const participation = page.getByLabel("Participou: Equipe Azul · #12 · Ana", {
    exact: true,
  });
  await participation.focus();
  await participation.press("Space");
  await expect(participation).toBeChecked();
  await expect(participation).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("participação");
  await expect(participation).toHaveAttribute("aria-describedby", "keyboard-error");
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
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
test("duplicate jersey highlights and focuses second athlete on the same team", async ({
  page,
}) => {
  await page.goto(`${url}?setup`);
  await page.getByLabel("Carla", { exact: true }).check();
  await page.getByLabel("Camisa de Carla", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Iniciar transcrição" }).click();
  const duplicate = page.getByLabel("Camisa de Carla", { exact: true });
  await expect(duplicate).toBeFocused();
  await expect(duplicate).toHaveAttribute("aria-invalid", "true");
  await expect(duplicate).toHaveAttribute("aria-describedby", "keyboard-error");
  await duplicate.fill("13");
  await page.getByRole("button", { name: "Iniciar transcrição" }).click();
  await expect(page.getByLabel("Camisa, B ou C", { exact: true })).toBeFocused();
});
test("invalid action identifies the action field, not the jersey", async ({ page }) => {
  await page.goto(url);
  const jersey = page.getByLabel("Camisa, B ou C", { exact: true });
  await jersey.fill("12");
  await jersey.press("Enter");
  const action = page.locator(".keyboard-entry input").nth(1);
  await action.fill("X");
  await action.press("Enter");
  await expect(action).toBeFocused();
  await expect(action).toHaveAttribute("aria-invalid", "true");
  await expect(action).toHaveAttribute("aria-describedby", "keyboard-error keyboard-help");
  await expect(jersey).toHaveAttribute("aria-invalid", "false");
});
test("revision confirmation requires an associated reason and focuses it", async ({ page }) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await page.getByRole("button", { name: "Revisar totais e confirmar" }).click();
  await expect(page.getByLabel("Motivo da correção")).toBeVisible();
  await page.getByRole("button", { name: "Revisar totais e confirmar" }).click();
  const reason = page.getByLabel("Motivo da correção");
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute("aria-describedby", "keyboard-error");
  await expect(page.getByRole("alert")).toContainText("pelo menos 10 caracteres");
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
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.locator(".keyboard-history li")).toHaveCount(2);
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
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

test("Ctrl+Z edits native input history without undoing scoresheet events", async ({ page }) => {
  await page.goto(url);
  await entry(page, "12", "3");
  const jersey = page.getByLabel("Camisa, B ou C", { exact: true });
  await jersey.pressSequentially("12");
  await expect(jersey).toHaveValue("12");
  await jersey.press("Control+z");
  await expect(jersey).not.toHaveValue("12");
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
  await jersey.press("Control+y");
  await expect(jersey).toHaveValue("12");
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
});

test("divergent local recovery survives two reloads byte-for-byte until an explicit choice", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await expect(page.getByRole("status")).toHaveText("Rascunho salvo no servidor");
  const savedRaw = await page.evaluate(() => {
    const key = "bdb:keyboard:v1:990";
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing local copy");
    const server = JSON.parse(sessionStorage.getItem("keyboard-server") ?? "{}");
    server.version = 17;
    server.initial.events = [];
    sessionStorage.setItem("keyboard-server", JSON.stringify(server));
    return raw;
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.reload();
    await expect(page.getByRole("complementary", { name: "Recuperação" })).toBeVisible();
    // Playwright's editable predicate does not account for an inert ancestor.
    // Assert that the browser prevents focusing and typing in the editor.
    const jersey = page.getByLabel("Camisa, B ou C", { exact: true });
    await expect(page.locator(".keyboard-sheet > div[inert]")).toHaveCount(1);
    await page.getByRole("button", { name: "Recuperar cópia local" }).focus();
    await page.keyboard.press("Tab");
    await expect(jersey).not.toBeFocused();
    const before = await jersey.inputValue();
    await page.keyboard.type("12");
    await expect(jersey).toHaveValue(before);
    expect(await page.evaluate(() => localStorage.getItem("bdb:keyboard:v1:990"))).toBe(savedRaw);
  }
  await page.getByRole("button", { name: "Recuperar cópia local" }).click();
  await expect(page.locator(".keyboard-history li")).toHaveCount(1);
  await expect(page.getByRole("complementary", { name: "Recuperação" })).toHaveCount(0);
});

test("discard replaces the local copy only after selection", async ({ page }) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await expect(page.getByRole("status")).toHaveText("Rascunho salvo no servidor");
  const original = await page.evaluate(() => {
    const key = "bdb:keyboard:v1:990";
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing local copy");
    const server = JSON.parse(sessionStorage.getItem("keyboard-server") ?? "{}");
    server.initial.events = [];
    sessionStorage.setItem("keyboard-server", JSON.stringify(server));
    return raw;
  });
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("bdb:keyboard:v1:990"))).toBe(original);
  await page.getByRole("button", { name: "Usar versão do servidor" }).click();
  await expect(page.locator(".keyboard-history li")).toHaveCount(0);
  const updated = await page.evaluate(() => localStorage.getItem("bdb:keyboard:v1:990"));
  expect(updated).not.toBe(original);
  expect(JSON.parse(updated ?? "{}").document.events).toEqual([]);
});

test("invalid local JSON is preserved and recover is disabled until export or discard", async ({
  page,
}) => {
  await page.goto(url);
  const damaged = '{"document":{"events": invalid}}';
  await page.evaluate((raw) => localStorage.setItem("bdb:keyboard:v1:990", raw), damaged);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Recuperação" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recuperar cópia local" })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("bdb:keyboard:v1:990"))).toBe(damaged);
  await page.getByRole("button", { name: "Usar versão do servidor" }).click();
  expect(await page.evaluate(() => localStorage.getItem("bdb:keyboard:v1:990"))).not.toBe(damaged);
});

test("participation errors only annotate the matching team when jerseys are shared", async ({
  page,
}) => {
  await page.goto(url);
  await entry(page, "12", "3");
  await page
    .getByText("Participação em quadra — conferir atletas sem pontos", { exact: true })
    .click();
  const home = page.getByLabel("Participou: Equipe Azul · #12 · Ana", { exact: true });
  const away = page.getByLabel("Participou: Equipe Verde · #12 · Bia", { exact: true });
  // The business rule rejects the uncheck and restores the original state.
  await home.click();
  await expect(home).toBeChecked();
  await expect(home).toHaveAttribute("aria-invalid", "true");
  await expect(home).toHaveAttribute("aria-describedby", "keyboard-error");
  await expect(away).not.toHaveAttribute("aria-invalid", "true");
  await expect(away).not.toHaveAttribute("aria-describedby", "keyboard-error");
});

test("team, period, and mode changes are announced in a live region", async ({ page }) => {
  await page.goto(url);
  const announcement = page.locator('[aria-live="polite"][aria-atomic="true"]');
  await expect(announcement).toContainText("Equipe Equipe Azul");
  await page.getByRole("button", { name: "Equipe B · Equipe Verde", exact: true }).click();
  await expect(announcement).toContainText("Equipe Equipe Verde");
  await page.getByLabel("Período ativo").selectOption("2");
  await expect(announcement).toContainText("Q2");
  await page.getByRole("button", { name: /Modo: Pontos/ }).click();
  await expect(announcement).toContainText("Modo faltas");
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
