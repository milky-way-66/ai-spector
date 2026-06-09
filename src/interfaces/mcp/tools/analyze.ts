import { join } from "node:path";
import { resolveProjectPaths } from "../../../core/util/paths.js";
import { loadDocflowConfig } from "../../../core/config/load.js";
import { runAnalyzePrep } from "../../../core/operations/analyze.js";
import { pathExists, readJson } from "../../../core/util/fs.js";
import { packageBundleRoot } from "../../../core/config/load.js";
import type { AnalyzeSchema, KnowledgeStatusSchema, KnowledgeValidateSchema } from "../schemas.js";
import type { z } from "zod";

// ── analyze ───────────────────────────────────────────────────────────────────

export async function toolAnalyze(input: z.infer<typeof AnalyzeSchema>) {
  const result = await runAnalyzePrep(input.root, { merge: input.merge });
  return result;
}

// ── knowledge_status ──────────────────────────────────────────────────────────

type KnowledgeDoc = {
  actors?: unknown[];
  useCases?: unknown[];
  features?: unknown[];
  functionalRequirements?: unknown[];
  nonFunctionalRequirements?: unknown[];
  dataEntities?: unknown[];
};

export async function toolKnowledgeStatus(input: z.infer<typeof KnowledgeStatusSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  const analysisDir = join(projectRoot, ".ai-spector/.docflow/analysis");

  const knowledgePath = join(analysisDir, "knowledge.json");
  const gapsPath = join(analysisDir, "gaps.json");
  const scopePath = join(analysisDir, "scope.json");

  const [knowledgeExists, gapsExists, scopeExists] = await Promise.all([
    pathExists(knowledgePath),
    pathExists(gapsPath),
    pathExists(scopePath),
  ]);

  if (!knowledgeExists) {
    return {
      ready: false,
      knowledgeExists: false,
      gapsExists,
      scopeExists,
      message: "knowledge.json not found — run 'analyze' to extract entities from data-source",
    };
  }

  const [knowledge, knowledgeStat] = await Promise.all([
    readJson<KnowledgeDoc>(knowledgePath),
    import("node:fs/promises").then((fs) => fs.stat(knowledgePath)),
  ]);

  const counts = {
    actors: knowledge.actors?.length ?? 0,
    useCases: knowledge.useCases?.length ?? 0,
    features: knowledge.features?.length ?? 0,
    functionalRequirements: knowledge.functionalRequirements?.length ?? 0,
    nonFunctionalRequirements: knowledge.nonFunctionalRequirements?.length ?? 0,
    dataEntities: knowledge.dataEntities?.length ?? 0,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    ready: total > 0,
    knowledgeExists: true,
    gapsExists,
    scopeExists,
    lastModified: knowledgeStat.mtime.toISOString(),
    entityCounts: counts,
    totalEntities: total,
    message: total === 0
      ? "knowledge.json exists but contains no entities — re-run analysis"
      : `${total} entities ready to merge`,
  };
}

// ── knowledge_validate ────────────────────────────────────────────────────────

export async function toolKnowledgeValidate(input: z.infer<typeof KnowledgeValidateSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  const knowledgePath = join(projectRoot, ".ai-spector/.docflow/analysis/knowledge.json");

  if (!(await pathExists(knowledgePath))) {
    return {
      valid: false,
      errors: [{ message: "knowledge.json not found", path: knowledgePath }],
      warnings: [],
    };
  }

  const { createRequire } = await import("node:module");
  const _require = createRequire(import.meta.url);
  const Ajv = _require("ajv/dist/2020.js") as typeof import("ajv/dist/2020.js").default;
  const addFormats = _require("ajv-formats") as typeof import("ajv-formats").default;

  const schemaPath = join(packageBundleRoot(), "schemas/schema.knowledge.json");
  const [knowledge, schema] = await Promise.all([
    readJson<unknown>(knowledgePath),
    readJson<unknown>(schemaPath),
  ]);

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateFn = ajv.compile(schema as object);
  const valid = validateFn(knowledge);

  const errors = valid
    ? []
    : (validateFn.errors ?? []).map((e) => ({
        path: e.instancePath || "/",
        message: e.message ?? "unknown error",
      }));

  return {
    valid,
    errors,
    warnings: [],
    knowledgePath,
  };
}
