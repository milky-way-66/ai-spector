#!/usr/bin/env node
/**
 * One-off: rewrite deep relative imports (../../ or deeper, or tests → src) to @/ aliases.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const srcRoot = join(repoRoot, "src");

const IMPORT_RE =
  /(?:from\s+|import\s*\(\s*|export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+)["']([^"']+)["']/g;

function shouldConvert(specifier) {
  if (!specifier.startsWith(".")) return false;
  if (/^(?:\.\.\/){2,}/.test(specifier)) return true;
  if (/(?:\.\.\/)+src\//.test(specifier)) return true;
  return false;
}

function toAlias(filePath, specifier) {
  const absImport = resolve(dirname(filePath), specifier);
  const relToSrc = relative(srcRoot, absImport);
  if (relToSrc.startsWith("..")) return null;
  return `@/${relToSrc.replace(/\\/g, "/")}`;
}

function migrateFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  let changed = false;

  const updated = original.replace(IMPORT_RE, (match, specifier) => {
    if (!shouldConvert(specifier)) return match;
    const alias = toAlias(filePath, specifier);
    if (!alias || alias === specifier) return match;
    changed = true;
    return match.replace(specifier, alias);
  });

  if (changed) {
    writeFileSync(filePath, updated, "utf8");
    console.log(relative(repoRoot, filePath));
  }
}

function walkTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTsFiles(full, out);
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

for (const file of [...walkTsFiles(join(repoRoot, "src")), ...walkTsFiles(join(repoRoot, "tests"))]) {
  migrateFile(file);
}
