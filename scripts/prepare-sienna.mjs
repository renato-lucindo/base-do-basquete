import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const EXPECTED_VERSION = "2.2.333";
const CDN_ASSET_ROOT = "https://cdn.jsdelivr.net/npm/sienna-accessibility/dist/";
const LOCAL_ASSET_ROOT = "/vendor/sienna/";

const require = createRequire(import.meta.url);
const packageEntry = require.resolve("sienna-accessibility");
const packageRoot = path.resolve(path.dirname(packageEntry), "..");
const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));

if (packageJson.version !== EXPECTED_VERSION) {
  throw new Error(
    `Versao inesperada do Sienna: ${packageJson.version}. Revise a integracao antes de atualizar.`,
  );
}

const sourceDirectory = path.join(packageRoot, "dist");
const targetDirectory = path.resolve("public", "vendor", "sienna");
await mkdir(targetDirectory, { recursive: true });

const source = await readFile(path.join(sourceDirectory, "sienna.min.js"), "utf8");
const localizedSource = source
  .replaceAll(CDN_ASSET_ROOT, LOCAL_ASSET_ROOT)
  .replace("catch{Ce(e,o)}", "catch{}")
  .replace("catch{t=Le(e)}", "catch{t=null}");

if (
  localizedSource === source ||
  localizedSource.includes(CDN_ASSET_ROOT) ||
  localizedSource.includes("catch{Ce(e,o)}") ||
  localizedSource.includes("catch{t=Le(e)}")
) {
  throw new Error("Nao foi possivel tornar os recursos do Sienna locais.");
}

await Promise.all([
  writeFile(path.join(targetDirectory, "sienna.min.js"), localizedSource, "utf8"),
  cp(path.join(sourceDirectory, "fonts"), path.join(targetDirectory, "fonts"), {
    force: true,
    recursive: true,
  }),
  cp(path.join(sourceDirectory, "locales"), path.join(targetDirectory, "locales"), {
    force: true,
    recursive: true,
  }),
  cp(path.join(packageRoot, "LICENSE"), path.join(targetDirectory, "LICENSE"), {
    force: true,
  }),
]);

console.log(`Sienna ${EXPECTED_VERSION} preparado com recursos locais.`);
