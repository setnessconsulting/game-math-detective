import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(full);
  }
}

walk("src");

const forbidden = [
  /from\s+["'][^"']*levelbest/i,
  /import\s*\(\s*["'][^"']*levelbest/i,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /document\.cookie/,
  /\bfetch\s*\(/,
];
const violations = [];

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(contents)) violations.push(file + ": matched " + pattern);
  }
}

if (violations.length > 0) {
  console.error("Standalone boundary violations:");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Standalone runtime boundary verification passed:", files.length, "source files");
}
