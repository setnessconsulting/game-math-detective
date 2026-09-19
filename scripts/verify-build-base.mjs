import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";

const base = "/game-assets/math-detective/ci/";
await build({
  configFile: resolve("vite.config.ts"),
  base,
});

const indexPath = resolve("dist", "index.html");
if (!existsSync(indexPath)) throw new Error("Subpath build did not produce dist/index.html");

const html = readFileSync(indexPath, "utf8");
if (!html.includes(base)) throw new Error("Subpath build did not retain the configured asset base");
if (/["'(=]\/(?:assets|src)\//.test(html)) {
  throw new Error("Subpath build contains a domain-root asset reference");
}

console.log("Static base verification passed:", base);
