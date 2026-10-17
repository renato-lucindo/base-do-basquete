// Browser integration with the real disposable GoTrue/PostgREST stack created by CI.
// Called only after the SQL and authenticated-RPC integration have succeeded.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

export async function verifyDisposableBrowser({ sql, status, adminUser, password, totp, helpers }) {
  assert.equal(process.env.CI, "true");
  assert.equal(new URL(status.API_URL).hostname, "127.0.0.1");

  const fixtureSource = readFileSync(
    "supabase/tests/database/keyboard_emergency_fallback.test.sql",
    "utf8",
  );
  const boundary = fixtureSource.indexOf("create temp table fallback_keyboard_doc");
  assert.ok(boundary > 0, "Fallback fixture boundary changed");
  const fixture = fixtureSource
    .slice(0, boundary)
    .replace("\\ir ../helpers/final_profile_fixtures.inc", () => helpers)
    .replace("create extension if not exists pgtap with schema extensions;", "")
    .replace("select no_plan();", "");
  await sql(`${fixture}\ncommit;`);

  // The file is ignored by Git. Exclusive creation protects pre-existing developer state.
  const varsPath = ".dev.vars";
  writeFileSync(
    varsPath,
    `SUPABASE_URL=${status.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\nSESSION_SECRET=${randomBytes(32).toString("base64url")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  let browser;
  let output = "";
  const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"],
    // Exercise the production MFA guard against local disposable services.
    // Preview password admission is deliberately absent from this AAL2 test.
    env: { ...process.env, CLOUDFLARE_ENV: "production" },
    // Keep npm and the dev server in one process group for CI cleanup.
    detached: process.platform !== "win32",
  });
  const record = (chunk) => {
    output = (output + chunk.toString()).slice(-2500);
  };
  server.stdout.on("data", record);
  server.stderr.on("data", record);
  try {
    const origin = "http://127.0.0.1:5173";
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Dev server exited: ${output}`);
      try {
        const response = await fetch(`${origin}/admin/login`, {
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Dev server not accepting connections yet.
      }
      await delay(1000);
    }
    assert.ok(ready, `Real app was not ready: ${output}`);
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message.slice(0, 500)));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text().slice(0, 500));
    });
    page.setDefaultTimeout(15000);
    const navigationEvents = [];
    page.on("request", (request) => {
      if (request.url().includes("/admin/games/93501")) {
        navigationEvents.push({ event: "request", method: request.method(), url: request.url() });
      }
    });
    page.on("response", (response) => {
      if (response.url().includes("/admin/games/93501")) {
        navigationEvents.push({
          event: "response",
          status: response.status(),
          url: response.url(),
          location: response.headers().location ?? null,
        });
      }
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/admin/games/93501")) {
        navigationEvents.push({
          event: "requestfailed",
          url: request.url(),
          failure: request.failure(),
        });
      }
    });

    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(adminUser.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/admin\/mfa$/);
    await page.getByLabel("Código de seis dígitos").fill(totp());
    await page.getByRole("button", { name: "Confirmar acesso" }).click();
    await expect(page).toHaveURL(/\/admin\/competitions$/);

    await page.goto("/admin/competitions/9350/scoresheets/new");
    const fallbackEntry = page.getByRole("link", { name: /Iniciar fallback emergencial/ });
    await expect(fallbackEntry).toBeVisible();
    const fallbackHref = await fallbackEntry.getAttribute("href");
    await fallbackEntry.click();
    try {
      await expect(page).toHaveURL(/\/admin\/games\/93501\/scoresheet\/keyboard$/);
    } catch (cause) {
      const editorUrl = `${origin}/admin/games/93501/scoresheet/keyboard`;
      const initialResponse = await context.request.get(editorUrl, { maxRedirects: 0 });
      const finalResponse = await context.request.get(editorUrl);
      console.error("Fallback browser navigation diagnostics", {
        actualUrl: page.url(),
        fallbackHref,
        directGetStatus: initialResponse.status(),
        directGetLocation: initialResponse.headers().location ?? null,
        directGetFinalStatus: finalResponse.status(),
        directGetFinalUrl: finalResponse.url(),
        navigationEvents: navigationEvents.slice(-20),
        visibleText: (await page.locator("body").innerText()).slice(0, 1500),
        browserErrors,
      });
      throw cause;
    }
    await page.getByRole("button", { name: "Iniciar transcrição" }).click();
    try {
      await expect(page.getByLabel("Camisa, B ou C", { exact: true })).toBeVisible({
        timeout: 6000,
      });
    } catch (cause) {
      console.error("Keyboard setup transition diagnostics", {
        url: page.url(),
        setupButtonVisible: await page
          .getByRole("button", { name: "Iniciar transcrição" })
          .isVisible(),
        alerts: await page.getByRole("alert").allTextContents(),
        status: await page.getByRole("status").allTextContents(),
        body: (await page.locator("body").innerText()).slice(-2400),
        browserErrors,
      });
      throw cause;
    }

    async function entry(jersey, code) {
      const target = page.getByLabel("Camisa, B ou C", { exact: true });
      await target.fill(jersey);
      await target.press("Enter");
      const action = page.locator(".keyboard-entry input").nth(1);
      await action.fill(code);
      await action.press("Enter");
    }

    // Simulate a response lost *after* PostgREST has committed the first event.
    // The operator's retry must use the same request identity and avoid a second revision.
    const apiPath = "**/api/admin/games/93501/keyboard-scoresheet";
    let intercepted = false;
    await page.route(apiPath, async (route) => {
      if (intercepted) return route.continue();
      intercepted = true;
      const result = await route.fetch();
      assert.equal(result.status(), 200, "First browser save must reach real PostgREST");
      await route.abort("failed");
    });
    await entry("10", "3");
    await expect(page.getByRole("status")).toHaveText("Alterações aguardando salvamento");
    assert.ok(intercepted, "Expected a real HTTP request");
    assert.equal(
      Number(
        await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93501"),
      ),
      1,
    );
    await page.unroute(apiPath);
    await page.getByRole("button", { name: "Salvar / tentar novamente" }).click();
    await expect(page.getByRole("status")).toHaveText("Rascunho salvo no servidor");
    assert.equal(
      Number(
        await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93501"),
      ),
      1,
      "HTTP retry must use the original idempotency receipt",
    );

    const staleContext = await browser.newContext({
      baseURL: origin,
      storageState: await context.storageState(),
    });
    const stalePage = await staleContext.newPage();
    stalePage.setDefaultTimeout(15000);
    await stalePage.goto("/admin/games/93501/scoresheet/keyboard");
    await expect(stalePage.locator(".keyboard-history li")).toHaveCount(1);

    await page.getByRole("button", { name: /Equipe B ·/ }).click();
    await entry("20", "2");
    await expect(page.getByRole("status")).toHaveText("Rascunho salvo no servidor");

    // Another tab still holds version 1 and must be rejected by the real backend.
    const staleTeam = stalePage.getByRole("button", { name: /Equipe A ·/ });
    await staleTeam.click();
    await expect(staleTeam).toHaveAttribute("aria-pressed", "true");
    const staleJersey = stalePage.getByLabel("Camisa, B ou C", { exact: true });
    await staleJersey.fill("10");
    await staleJersey.press("Enter");
    const staleAction = stalePage.locator(".keyboard-entry input").nth(1);
    await staleAction.fill("3");
    const conflictResponse = stalePage.waitForResponse((response) =>
      response.url().includes("/api/admin/games/93501/keyboard-scoresheet"),
    );
    await staleAction.press("Enter");
    assert.equal((await conflictResponse).status(), 409, "Valid stale edit reaches backend CAS");
    await expect(stalePage.getByRole("alert")).toContainText("outra aba");
    assert.equal(
      Number(
        await sql("select count(*) from public.keyboard_scoresheet_revisions where game_id=93501"),
      ),
      2,
      "Version conflict must not create a revision",
    );
    await staleContext.close();

    await page.getByRole("button", { name: "Revisar totais e confirmar" }).click();
    await expect(page.getByRole("alert")).toContainText("motivo do fallback");
    await page
      .getByLabel("Motivo do fallback emergencial")
      .fill("O documento FIBA oficial não chegou e a partida precisa de registro auditado.");
    await page.getByRole("button", { name: "Revisar totais e confirmar" }).click();
    try {
      await expect(page.getByRole("status")).toContainText("Fallback manual confirmado");
    } catch (cause) {
      console.error("Fallback confirmation diagnostics", {
        status: await page.getByRole("status").allTextContents(),
        alerts: await page.getByRole("alert").allTextContents(),
        saveResponses: navigationEvents
          .filter((event) => event.url.includes("/keyboard-scoresheet"))
          .slice(-5),
      });
      throw cause;
    }

    assert.equal(
      await sql(`select role from public.game_data_submissions where id=(
        select submission_id from public.keyboard_scoresheets where game_id=93501
      )`),
      "fallback",
    );
    assert.equal(
      Number(
        await sql(
          "select coalesce(sum(points),0) from public.game_period_scores where game_id=93501",
        ),
      ),
      5,
    );
    assert.equal(
      Number(
        await sql("select count(*) from public.game_data_domain_authority where game_id=93501"),
      ),
      6,
    );

    // A divergent browser copy must survive repeated reloads until the operator decides.
    const copyKey = "bdb:keyboard:v1:93501";
    const original = await page.evaluate(
      ([key, eventId]) => {
        const saved = JSON.parse(localStorage.getItem(key));
        saved.document.events.push({
          id: eventId,
          side: "home",
          period: 1,
          target: "10",
          code: "1",
        });
        const value = JSON.stringify(saved);
        localStorage.setItem(key, value);
        return value;
      },
      [copyKey, randomUUID()],
    );
    await page.reload();
    await expect(page.getByRole("complementary", { name: "Recuperação" })).toBeVisible();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), copyKey), original);
    await page.reload();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), copyKey), original);
    await page.getByRole("button", { name: "Recuperar cópia local" }).click();
    await expect(page.locator(".keyboard-history li")).toHaveCount(3);
    console.log(
      "PASS: real browser login/MFA, fallback, retry, concurrent edit conflict and recovery",
    );
    await context.close();
  } finally {
    if (server.pid && process.platform !== "win32") {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch (error) {
        if (error?.code !== "ESRCH") {
          console.error("Failed to stop the disposable dev server process group", error);
          process.exitCode = 1;
        }
      }
    } else {
      server.kill();
    }
    server.stdout.destroy();
    server.stderr.destroy();
    await browser?.close();
    unlinkSync(varsPath);
    console.log("PASS: disposable browser and dev server cleaned up");
  }
}
