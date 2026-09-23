import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["time.js", "cities.js", "overlap.js", "format.js", "codec.js", "app.js"];

function stripModuleSyntax(source, filename) {
  const withoutImports = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("import "))
    .join("\n");
  if (withoutImports.includes(" from \"./")) {
    throw new Error(`${filename} still has an import. Keep each import on one line.`);
  }
  return withoutImports.replace(/^export /gm, "");
}

const bundled = files.map((name) => stripModuleSyntax(readFileSync(join(root, "src", name), "utf8"), name)).join("\n");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src", "styles.css"), "utf8");
const standalone = html
  .replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`,
  )
  .replace('<link rel="stylesheet" href="./src/styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./src/app.js"></script>', () => `<script type="module">\n${bundled}\n</script>`);

if (standalone.includes('src="./') || standalone.includes("from \"./")) {
  throw new Error("Standalone file still points at external source.");
}

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "whencanwe.html"), standalone);
writeFileSync(join(root, "dist", "whencanwe.mjs"), bundled);
console.log("Wrote dist/whencanwe.html");
