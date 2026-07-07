import { createRequire } from "node:module";
import { join } from "node:path";
import type { DocflowConfig } from "../config/types.js";
import { legacyDocflowLanguageDiffersFromDocops } from "../config/language-from-docops.js";
import { pathExists, readJson } from "../util/fs.js";
import { assessDocopsProject, type DocopsAssessment, type DocopsGap } from "./assess.js";
import { resolveContractsRoot, resolveBootstrapRoot } from "./bootstrap.js";
import { mergeDocopsDefaults, readDocopsConfig } from "./config.js";
import { ensureOptionalDocTypes, missingOptionalDocTypeKeys } from "./layer-defaults.js";
import { migrateDocopsLayout } from "./migrate.js";
import {
  DEFAULT_CAPABILITIES,
  DEFAULT_DOCOPS_PATHS,
  DOCOPS_CONFIG_REL,
  LEGACY_DOCFLOW_CONFIG_REL,
  type DocopsPathKey,
} from "./paths.js";
import type { DocopsConfig } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv/dist/2020.js") as typeof import("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats") as typeof import("ajv-formats").default;

export interface DocopsCheckAction {
  id: string;
  severity: "blocking" | "warning";
  message: string;
  fix: string;
  command?: string;
}

export interface DocopsCheckResult {
  valid: boolean;
  configPath: string;
  configExists: boolean;
  schemaValid: boolean;
  schemaErrors: string[];
  configDrift: boolean;
  driftSummary: string[];
  layout: DocopsAssessment["layout"];
  writerReady: boolean;
  recommendedAction: DocopsAssessment["recommendedAction"];
  recommendedCommand: string;
  actions: DocopsCheckAction[];
  repairPreview: string[];
  agentPrompt: string;
}

async function resolveDocopsConfigSchemaPath(projectRoot: string): Promise<string | null> {
  const guideSchema = join(projectRoot, ".docops/guide/schemas/docops.config.schema.json");
  if (await pathExists(guideSchema)) {
    return guideSchema;
  }
  try {
    const contractsRoot = resolveContractsRoot(resolveBootstrapRoot());
    const bundled = join(contractsRoot, "schemas/docops.config.schema.json");
    if (await pathExists(bundled)) {
      return bundled;
    }
  } catch {
    // bootstrap bundle unavailable in some test fixtures
  }
  return null;
}

function validateDocopsConfigSchema(
  raw: unknown,
  schemaPath: string,
): Promise<{ valid: boolean; errors: string[] }> {
  return readJson<Record<string, unknown>>(schemaPath)
    .then((schema) => {
      const { $schema: _meta, ...schemaBody } = schema;
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(schemaBody);
      if (validate(raw)) {
        return { valid: true, errors: [] };
      }
      const errors = (validate.errors ?? []).map(
        (err) => `${err.instancePath || "/"} ${err.message ?? "invalid"}`,
      );
      return { valid: false, errors };
    })
    .catch((error: unknown) => ({
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    }));
}

function detectConfigDrift(raw: Partial<DocopsConfig> | null): string[] {
  if (!raw) {
    return [`${DOCOPS_CONFIG_REL} missing`];
  }

  const drift: string[] = [];
  const merged = mergeDocopsDefaults(raw);
  const withOptional = {
    ...merged,
    docTypes: ensureOptionalDocTypes(merged.docTypes ?? {}),
  };

  for (const key of Object.keys(DEFAULT_DOCOPS_PATHS) as DocopsPathKey[]) {
    const onDisk = raw.paths?.[key]?.trim();
    const expected = withOptional.paths[key];
    if (!onDisk) {
      drift.push(`paths.${key} missing on disk (expected "${expected}")`);
    }
  }

  for (const key of missingOptionalDocTypeKeys(raw.docTypes)) {
    drift.push(`docTypes.${key} missing on disk (add disabled entry via repair)`);
  }

  for (const key of Object.keys(DEFAULT_CAPABILITIES) as Array<keyof typeof DEFAULT_CAPABILITIES>) {
    if (raw.capabilities?.[key] === undefined) {
      drift.push(`capabilities.${key} missing on disk (default: ${String(DEFAULT_CAPABILITIES[key])})`);
    }
  }

  if (JSON.stringify(mergeDocopsDefaults(raw)) !== JSON.stringify(withOptional)) {
    const optionalOnly = missingOptionalDocTypeKeys(raw.docTypes);
    if (optionalOnly.length === 0 && drift.length === 0) {
      drift.push("config differs from latest contract defaults after merge");
    }
  }

  return drift;
}

function gapToAction(gap: DocopsGap): DocopsCheckAction {
  let command: string | undefined;
  if (gap.fix?.includes("docops migrate --repair") || gap.id.startsWith("DOCOPS-CFG-")) {
    command = "npx ai-spector docops migrate --repair";
  } else if (gap.fix?.includes("docops init")) {
    command = "npx ai-spector docops init";
  } else if (gap.fix?.includes("docops migrate") && !gap.fix.includes("--repair")) {
    command = "npx ai-spector docops migrate";
  } else if (gap.fix?.includes("docops registry sync")) {
    command = "npx ai-spector docops registry sync";
  } else if (gap.fix?.startsWith("npx ")) {
    command = gap.fix;
  }

  return {
    id: gap.id,
    severity: gap.severity,
    message: gap.message,
    fix: gap.fix ?? "See message",
    ...(command ? { command } : {}),
  };
}

function recommendedCommandFor(
  recommendedAction: DocopsAssessment["recommendedAction"],
  configDrift: boolean,
): string {
  if (recommendedAction === "repair" || configDrift) {
    return "npx ai-spector docops migrate --repair";
  }
  if (recommendedAction === "migrate") {
    return "npx ai-spector docops migrate";
  }
  if (recommendedAction === "init") {
    return "npx ai-spector docops init";
  }
  return "npx ai-spector docops status";
}

function buildAgentPrompt(result: Omit<DocopsCheckResult, "agentPrompt">): string {
  const lines: string[] = [
    "Check docops config for this repo and fix any issues.",
    "",
    `Layout: ${result.layout} | writerReady: ${result.writerReady} | schemaValid: ${result.schemaValid} | configDrift: ${result.configDrift}`,
    `Recommended: ${result.recommendedCommand}`,
    "",
  ];

  if (result.actions.length === 0) {
    lines.push("No issues found — docops.config.json matches the Writer contract.");
    return lines.join("\n");
  }

  lines.push("Issues (fix in order; prefer command when listed):");
  for (const [index, action] of result.actions.entries()) {
    lines.push(`${index + 1}. [${action.id}] ${action.message}`);
    if (action.command) {
      lines.push(`   Run: ${action.command}`);
    } else {
      lines.push(`   Fix: ${action.fix}`);
    }
  }

  if (result.repairPreview.length > 0) {
    lines.push("", "Repair preview (dry-run):");
    for (const line of result.repairPreview.slice(0, 12)) {
      lines.push(`- ${line}`);
    }
    if (result.repairPreview.length > 12) {
      lines.push(`- ... and ${result.repairPreview.length - 12} more`);
    }
  }

  lines.push("", "After fixes, run: npx ai-spector docops check --json");
  return lines.join("\n");
}

export async function checkDocopsConfig(projectRoot: string): Promise<DocopsCheckResult> {
  const configPath = join(projectRoot, DOCOPS_CONFIG_REL).replace(/\\/g, "/");
  const configExists = await pathExists(join(projectRoot, DOCOPS_CONFIG_REL));
  const assessment = await assessDocopsProject(projectRoot);

  let raw: Partial<DocopsConfig> | null = null;
  let schemaValid = false;
  const schemaErrors: string[] = [];

  if (configExists) {
    try {
      raw = await readJson<Partial<DocopsConfig>>(join(projectRoot, DOCOPS_CONFIG_REL));
      const schemaPath = await resolveDocopsConfigSchemaPath(projectRoot);
      if (schemaPath) {
        const validation = await validateDocopsConfigSchema(raw, schemaPath);
        schemaValid = validation.valid;
        schemaErrors.push(...validation.errors);
      } else {
        schemaValid = (await readDocopsConfig(projectRoot)) !== null;
        if (!schemaValid) {
          schemaErrors.push("Could not parse docops.config.json");
        }
      }
    } catch (error) {
      schemaErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const driftSummary = configExists ? detectConfigDrift(raw) : [];
  const configDrift = driftSummary.length > 0;

  const actions: DocopsCheckAction[] = [];

  if (!configExists) {
    actions.push({
      id: "DOCOPS-001",
      severity: "blocking",
      message: `Missing ${DOCOPS_CONFIG_REL}`,
      fix: assessment.recommendedAction === "migrate" ? "Run docops migrate" : "Run docops init",
      command:
        assessment.recommendedAction === "migrate"
          ? "npx ai-spector docops migrate"
          : "npx ai-spector docops init",
    });
  }

  for (const err of schemaErrors) {
    actions.push({
      id: "DOCOPS-SCHEMA",
      severity: "blocking",
      message: `Schema validation: ${err}`,
      fix: "Fix JSON fields or run docops migrate --repair",
      command: "npx ai-spector docops migrate --repair",
    });
  }

  if (configExists && raw) {
    if (!Array.isArray(raw.languages) || raw.languages.length === 0) {
      actions.push({
        id: "CFG-001",
        severity: "blocking",
        message: "languages[] is empty or missing in docops.config.json",
        fix: "Add languages to docops.config.json or run lang add",
        command: "npx ai-spector lang add <code>",
      });
    }

    const hasLegacyDocflow = await pathExists(join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL));
    if (hasLegacyDocflow) {
      try {
        const legacyRaw = await readJson<Partial<DocflowConfig>>(
          join(projectRoot, LEGACY_DOCFLOW_CONFIG_REL),
        );
        const mismatch = legacyDocflowLanguageDiffersFromDocops(raw, legacyRaw);
        if (mismatch) {
          actions.push({
            id: "CFG-002",
            severity: "warning",
            message:
              `docops languages [${mismatch.docopsCodes.join(", ")}] disagree with legacy docflow ` +
              `[${mismatch.legacyCodes.join(", ") || "none"}] — generation uses docops`,
            fix: "Sync .ai-spector/docflow.config.json languages to match docops.config.json",
            command: "npx ai-spector docops migrate --repair",
          });
        }
      } catch {
        // legacy parse errors handled elsewhere
      }
    }

    for (const line of driftSummary) {
      if (actions.some((a) => a.message.includes(line))) {
        continue;
      }
      actions.push({
        id: "DOCOPS-DRIFT",
        severity: "warning",
        message: line,
        fix: "Run docops migrate --repair to sync config to latest contract",
        command: "npx ai-spector docops migrate --repair",
      });
    }
  }

  for (const gap of assessment.gaps) {
    if (actions.some((a) => a.id === gap.id)) {
      continue;
    }
    actions.push(gapToAction(gap));
  }

  let repairPreview: string[] = [];
  if (configExists) {
    const repair = await migrateDocopsLayout({ projectRoot, repair: true, dryRun: true });
    repairPreview = repair.actions.filter((a) => !a.startsWith("skip"));
  }

  const recommendedCommand = recommendedCommandFor(assessment.recommendedAction, configDrift);
  const blocking = actions.filter((a) => a.severity === "blocking");
  const valid =
    configExists && schemaValid && blocking.length === 0 && assessment.writerReady && !configDrift;

  const partial: Omit<DocopsCheckResult, "agentPrompt"> = {
    valid,
    configPath,
    configExists,
    schemaValid,
    schemaErrors,
    configDrift,
    driftSummary,
    layout: assessment.layout,
    writerReady: assessment.writerReady,
    recommendedAction: assessment.recommendedAction,
    recommendedCommand,
    actions,
    repairPreview,
  };

  return {
    ...partial,
    agentPrompt: buildAgentPrompt(partial),
  };
}
