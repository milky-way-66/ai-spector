import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrototypeConfig, PrototypeManifest } from "./types.js";
import { isPrototypeBasicAuthConfigured } from "./config.js";
import { findAbsoluteLocalRefs } from "./relative-assets.js";
import { checkViteRelativeBase, formatViteBasePathHint } from "./build-base-path.js";
import { pathExists, readJson } from "../util/fs.js";

const EXTERNAL_ASSET_RE =
  /(?:https?:)?\/\/(?:fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg\.|jsdelivr\.)/i;

export interface PrototypeValidationIssue {
  severity: "error" | "warn";
  code: string;
  message: string;
  path?: string;
}

export interface ValidatePrototypeOptions {
  projectRoot: string;
  config: PrototypeConfig;
  strict?: boolean;
  checkExternalAssets?: boolean;
}

export async function validatePrototype(
  opts: ValidatePrototypeOptions,
): Promise<PrototypeValidationIssue[]> {
  const issues: PrototypeValidationIssue[] = [];

  if (!isPrototypeBasicAuthConfigured(opts.config)) {
    issues.push({
      severity: "error",
      code: "BASIC_AUTH_MISSING",
      message:
        "Prototype basic auth not configured — ask the user for username/password, then: npx ai-spector prototype auth --username <u> --password <p>",
    });
  } else {
    const htpasswdPath = join(opts.projectRoot, opts.config.htpasswdFile);
    if (!(await pathExists(htpasswdPath))) {
      issues.push({
        severity: "error",
        code: "HTPASSWD_MISSING",
        message: `Missing ${opts.config.htpasswdFile} — run: npx ai-spector prototype auth --from-config`,
        path: htpasswdPath,
      });
    }
  }

  const manifestPath = join(opts.projectRoot, opts.config.prototypeDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    issues.push({
      severity: "error",
      code: "MANIFEST_MISSING",
      message: `Missing ${opts.config.prototypeDir}/manifest.json — run: npx ai-spector prototype setup`,
      path: manifestPath,
    });
    return issues;
  }

  const manifest = await readJson<PrototypeManifest>(manifestPath);
  if (manifest.schemaVersion !== 1) {
    issues.push({
      severity: "error",
      code: "MANIFEST_SCHEMA",
      message: `Unsupported manifest schemaVersion: ${manifest.schemaVersion}`,
    });
  }

  if (!manifest.themeName?.trim()) {
    issues.push({
      severity: "error",
      code: "THEME_MISSING",
      message: "manifest.json themeName is empty — run: npx ai-spector prototype setup --theme <name>",
    });
  }

  const stems = new Set<string>();
  for (const screen of manifest.screens ?? []) {
    if (stems.has(screen.prototypeStem)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_STEM",
        message: `Duplicate prototypeStem: ${screen.prototypeStem}`,
      });
    }
    stems.add(screen.prototypeStem);

    const htmlPath = join(opts.projectRoot, opts.config.srcDir, `${screen.prototypeStem}.html`);
    if (!(await pathExists(htmlPath))) {
      issues.push({
        severity: opts.strict ? "error" : "warn",
        code: "HTML_MISSING",
        message: `Missing HTML for ${screen.displayName}: ${opts.config.srcDir}/${screen.prototypeStem}.html`,
        path: htmlPath,
      });
    } else if (opts.checkExternalAssets !== false) {
      const html = await readFile(htmlPath, "utf8");
      if (EXTERNAL_ASSET_RE.test(html)) {
        issues.push({
          severity: "warn",
          code: "EXTERNAL_ASSET",
          message: `External CDN/font URL in ${screen.prototypeStem}.html — use tokens from prototype/DESIGN.md only`,
          path: htmlPath,
        });
      }
      const absoluteRefs = findAbsoluteLocalRefs(html);
      if (absoluteRefs.length > 0) {
        issues.push({
          severity: opts.strict ? "error" : "warn",
          code: "ABSOLUTE_ASSET_PATH",
          message: `Root-absolute asset refs in ${screen.prototypeStem}.html (${absoluteRefs.slice(0, 3).join(", ")}${absoluteRefs.length > 3 ? ", …" : ""}) — use relative paths from the current file (e.g. ./assets/app.js)`,
          path: htmlPath,
        });
      }
    }

    const docPath = join(opts.projectRoot, screen.screenDoc);
    if (!(await pathExists(docPath))) {
      issues.push({
        severity: "warn",
        code: "SCREEN_DOC_MISSING",
        message: `Screen design doc missing: ${screen.screenDoc}`,
        path: docPath,
      });
    }
  }

  const buildMode = opts.config.buildMode ?? "static";
  if (buildMode === "spa") {
    const viteCheck = await checkViteRelativeBase(opts.projectRoot, opts.config.techStack);
    if (viteCheck?.needsRelativeBase) {
      issues.push({
        severity: opts.strict ? "error" : "warn",
        code: "VITE_BASE_PATH",
        message: `Vite build will emit root-absolute asset URLs — ${formatViteBasePathHint(viteCheck)}`,
        path: viteCheck.configPath ?? undefined,
      });
    }

    const buildDest =
      opts.config.buildDest?.trim() || `${opts.config.prototypeDir}/dist`;
    const indexPath = join(opts.projectRoot, buildDest, "index.html");
    if (await pathExists(indexPath)) {
      const html = await readFile(indexPath, "utf8");
      const absoluteRefs = findAbsoluteLocalRefs(html);
      if (absoluteRefs.length > 0) {
        issues.push({
          severity: opts.strict ? "error" : "warn",
          code: "ABSOLUTE_ASSET_PATH",
          message: `Root-absolute asset refs in ${buildDest}/index.html (${absoluteRefs.slice(0, 3).join(", ")}${absoluteRefs.length > 3 ? ", …" : ""}) — set Vite base: './' and rebuild, or run prototype sync to rewrite paths`,
          path: indexPath,
        });
      }
    }
  }

  return issues;
}

export function formatPrototypeIssues(issues: PrototypeValidationIssue[]): string {
  if (issues.length === 0) {
    return "Prototype validation: OK";
  }
  return issues
    .map((i) => `[${i.severity.toUpperCase()}] ${i.code}: ${i.message}`)
    .join("\n");
}
