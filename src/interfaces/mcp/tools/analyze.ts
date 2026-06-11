import { join } from "node:path";
import { resolveProjectPaths } from "../../../core/util/paths.js";
import { loadDocflowConfig } from "../../../core/config/load.js";
import { pathExists, readJson } from "../../../core/util/fs.js";
import { packageBundleRoot } from "../../../core/config/load.js";
import { DEFAULT_LISTED_IN } from "../../../core/graph/defaults.js";
import type { KnowledgeStatusSchema, KnowledgeValidateSchema, KnowledgeSchemaSchema } from "../schemas.js";
import type { z } from "zod";

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
      message:
        "knowledge.json not found — graph scaffold is ready; write .ai-spector/.docflow/analysis/knowledge.json " +
        "(use knowledge_schema to get the exact shape and valid section IDs), then run knowledge_validate before graph_merge",
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

// ── knowledge_schema ──────────────────────────────────────────────────────────

export async function toolKnowledgeSchema(input: z.infer<typeof KnowledgeSchemaSchema>) {
  const { root: projectRoot } = await loadDocflowConfig(input.root);
  const paths = await resolveProjectPaths(input.root);

  const schemaPath = join(packageBundleRoot(), "schemas/schema.knowledge.json");
  const schema = await readJson<unknown>(schemaPath);

  // Load section IDs from the registry if it exists (post-analyze scaffold)
  let sectionIds: string[] = [];
  if (await pathExists(paths.registry)) {
    type Registry = { documents: Array<{ sections: Array<{ id: string }> }> };
    const registry = await readJson<Registry>(paths.registry);
    for (const doc of registry.documents ?? []) {
      for (const sec of doc.sections ?? []) {
        if (sec.id) sectionIds.push(sec.id);
      }
    }
  }

  const analysisDir = join(projectRoot, ".ai-spector/.docflow/analysis");

  return {
    schemaPath,
    schema,
    defaultListedInSections: DEFAULT_LISTED_IN,
    sectionIds: sectionIds.length > 0 ? sectionIds : null,
    sectionIdsNote:
      sectionIds.length > 0
        ? `${sectionIds.length} section IDs loaded from section registry. Use these as listedInSection values.`
        : "Section registry not found — run the index tool first to populate section IDs.",
    outputPath: join(analysisDir, "knowledge.json"),
    examplePayload: {
      knowledgeVersion: 1,
      actors: [
        {
          id: "actor.admin",
          name: "Administrator",
          description: "System administrator who manages users and configuration",
          listedInSection: DEFAULT_LISTED_IN.actor,
        },
      ],
      useCases: [
        {
          id: "uc.login",
          title: "User Login",
          priority: "High",
          description: "User authenticates with email and password",
          listedInSection: DEFAULT_LISTED_IN.useCase,
        },
      ],
      features: [
        {
          id: "feat.auth",
          title: "Authentication",
          description: "Email/password authentication with session management",
          listedInSection: DEFAULT_LISTED_IN.feature,
          satisfies: ["uc.login"],
        },
      ],
      functionalRequirements: [
        {
          id: "req.auth.1",
          title: "Login form validates email format",
          listedInSection: DEFAULT_LISTED_IN.functionalRequirement,
          tracesTo: ["feat.auth"],
        },
      ],
      nfrs: [
        {
          id: "nfr.perf.1",
          title: "Login response time under 500ms",
          listedInSection: DEFAULT_LISTED_IN.nfr,
        },
      ],
      entities: [
        {
          id: "ent.user",
          name: "User",
          description: "Registered system user",
          listedInSection: DEFAULT_LISTED_IN.dataEntity,
        },
      ],
    },
    gaps: {
      note: "Optional. Write to .ai-spector/.docflow/analysis/gaps.json",
      shape: {
        gaps: [
          {
            id: "gap.1",
            description: "Missing specification for password reset flow",
            category: "missing-requirement",
            severity: "medium",
          },
        ],
      },
    },
    scope: {
      note: "Optional. Write to .ai-spector/.docflow/analysis/scope.json",
      shape: {
        inScope: ["user authentication", "session management"],
        outOfScope: ["third-party SSO integration"],
        assumptions: ["Users have valid email addresses"],
      },
    },
  };
}
