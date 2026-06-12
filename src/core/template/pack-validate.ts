import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import type { PackManifest } from "../config/types.js";
import type { NodeType } from "../../types.js";
import { pathExists, readJson } from "../util/fs.js";
import {
  buildPackSetupState,
  type PackSetupItem,
  type PackSetupState,
} from "./pack-setup.js";

// ---------------------------------------------------------------------------
// Custom pack validation — detect gaps and produce questions for the user
// ---------------------------------------------------------------------------

export type PackGapSeverity = "blocking" | "should-ask" | "info";
export type PackGapPhase = "user" | "agent" | "import" | "verify";

export interface PackValidationGap {
  id: string;
  severity: PackGapSeverity;
  phase: PackGapPhase;
  category: string;
  message: string;
  /** Ask the user this during install completion / before first generate. */
  questionForUser?: string;
  fix?: string;
  path?: string;
}

export interface PackValidationResult {
  packName: string;
  ready: boolean;
  blockingCount: number;
  shouldAskCount: number;
  gaps: PackValidationGap[];
  /** Flat list of questions to present to the user (blocking first). */
  questionsForUser: string[];
  contextMapTodos: Array<{ placeholder: string; note?: string }>;
  graphDomainCounts: Record<string, number>;
  artifacts: Record<string, boolean>;
  setupStatus: "incomplete" | "ready";
}

const REQUIRED_ARTIFACTS = [
  "manifest.json",
  "generate-hints.md",
  "context-map.json",
  "readiness-criteria.json",
  "completeness-rules.json",
  "workflow-setup.md",
  "pack-setup.json",
  "install-checklist.md",
  "gen-status.json",
] as const;

const GATED_SKILL_RE = /task_list|readiness-criteria|workflow-setup|context-readiness/i;

function gap(
  partial: PackValidationGap & { id: string; severity: PackGapSeverity; message: string },
): PackValidationGap {
  return partial;
}

async function readSkillGatedFlow(root: string, packName: string): Promise<boolean> {
  const slug = packName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const skillPath = join(root, ".cursor", "skills", `ai-spector-generate-${slug}`, "SKILL.md");
  if (!existsSync(skillPath)) return false;
  const text = await readFile(skillPath, "utf8").catch(() => "");
  return GATED_SKILL_RE.test(text);
}

async function countGraphNodesByType(
  root: string,
): Promise<{ counts: Record<string, number>; graphLoaded: boolean }> {
  const graphPath = join(root, ".ai-spector", "graph", "traceability.graph.json");
  if (!(await pathExists(graphPath))) {
    return { counts: {}, graphLoaded: false };
  }
  try {
    const g = await loadInMemoryGraph(root);
    const counts: Record<string, number> = {};
    for (const node of g.nodesById.values()) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }
    return { counts, graphLoaded: true };
  } catch {
    return { counts: {}, graphLoaded: false };
  }
}

function mergeSetupWithValidation(
  setup: PackSetupState,
  detected: Record<string, boolean>,
): PackSetupState {
  const items: PackSetupItem[] = setup.items.map((item) => {
    if (item.id in detected) {
      return { ...item, done: detected[item.id]! };
    }
    return item;
  });
  const blocking = items.filter((i) => i.required && !i.done);
  return {
    ...setup,
    items,
    status: blocking.length === 0 ? "ready" : "incomplete",
    completedAt: blocking.length === 0 ? new Date().toISOString() : null,
  };
}

export interface ValidateCustomPackOptions {
  root: string;
  packName: string;
  /** Write updated pack-setup.json from auto-detected completion. */
  syncSetup?: boolean;
}

export async function validateCustomPack(
  opts: ValidateCustomPackOptions,
): Promise<PackValidationResult> {
  const { root, packName } = opts;
  const packDir = join(root, ".ai-spector", "packs", packName);
  const gaps: PackValidationGap[] = [];

  const manifestPath = join(packDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    return {
      packName,
      ready: false,
      blockingCount: 1,
      shouldAskCount: 0,
      gaps: [
        gap({
          id: "pack.missing",
          severity: "blocking",
          phase: "import",
          category: "artifact",
          message: `Pack "${packName}" is not installed.`,
          questionForUser: `Run template import and install for pack "${packName}" first.`,
          fix: "npx ai-spector template install",
        }),
      ],
      questionsForUser: [`Pack "${packName}" is not installed. Run template install first.`],
      contextMapTodos: [],
      graphDomainCounts: {},
      artifacts: {},
      setupStatus: "incomplete",
    };
  }

  const manifest = await readJson<PackManifest>(manifestPath);
  const docType = manifest.docType ?? manifest.packName;

  const artifacts: Record<string, boolean> = {};
  for (const name of REQUIRED_ARTIFACTS) {
    const exists = await pathExists(join(packDir, name));
    artifacts[name] = exists;
    if (!exists) {
      gaps.push(
        gap({
          id: `artifact.${name}`,
          severity: "blocking",
          phase: "agent",
          category: "artifact",
          message: `Missing required file: ${name}`,
          fix: `npx ai-spector template use ${packName}`,
          path: `.ai-spector/packs/${packName}/${name}`,
        }),
      );
    }
  }
  artifacts["pack-context/"] = await pathExists(join(packDir, "pack-context"));

  if (!artifacts["pack-context/"]) {
    gaps.push(
      gap({
        id: "artifact.pack-context",
        severity: "should-ask",
        phase: "agent",
        category: "artifact",
        message: "pack-context/ directory missing — per-template generation guides not generated.",
        fix: `npx ai-spector template use ${packName}`,
      }),
    );
  }

  if (!manifest.purpose?.trim()) {
    gaps.push(
      gap({
        id: "manifest.purpose",
        severity: "blocking",
        phase: "user",
        category: "manifest",
        message: "manifest.json has no purpose (SRS, arc42, ADR, …).",
        questionForUser:
          "What is this template pack for? (e.g. SRS per ISO 29148, arc42 architecture, internal PRD)",
        fix: `Edit .ai-spector/packs/${packName}/manifest.json — set "purpose"`,
        path: `.ai-spector/packs/${packName}/manifest.json`,
      }),
    );
  }

  if (!manifest.standards?.length) {
    gaps.push(
      gap({
        id: "manifest.standards",
        severity: "blocking",
        phase: "user",
        category: "manifest",
        message: "No standards alignment recorded in manifest.",
        questionForUser:
          "Which standards should readiness and documentation follow? (e.g. ISO/IEC/IEEE 29148, arc42, team-internal only)",
        fix: `Edit manifest.json — set "standards": ["ISO-29148", …]`,
        path: `.ai-spector/packs/${packName}/manifest.json`,
      }),
    );
  }

  const contextMapPath = join(packDir, "context-map.json");
  const contextMap = (await pathExists(contextMapPath))
    ? await readJson<{ placeholders?: Record<string, { source: string; note?: string }> }>(
        contextMapPath,
      ).catch(() => ({ placeholders: {} }))
    : { placeholders: {} };

  const contextMapTodos: Array<{ placeholder: string; note?: string }> = [];
  for (const [placeholder, entry] of Object.entries(contextMap.placeholders ?? {})) {
    if (entry.source === "TODO") {
      contextMapTodos.push({ placeholder, note: entry.note });
      gaps.push(
        gap({
          id: `context-map.${placeholder}`,
          severity: "blocking",
          phase: "user",
          category: "context-map",
          message: `Placeholder ${placeholder} has no graph/source mapping.`,
          questionForUser: `For template placeholders: what should ${placeholder} resolve to? (graph field, config value, or fixed text)`,
          fix: `Edit context-map.json — set source for ${placeholder}`,
          path: `.ai-spector/packs/${packName}/context-map.json`,
        }),
      );
    }
  }

  const hasLangInOutput = manifest.documents.some((d) =>
    (d.output ?? d.outputPattern ?? "").includes("{lang}"),
  );
  let languagesOk = !hasLangInOutput;
  if (hasLangInOutput) {
    try {
      const { config } = await loadDocflowConfig(root);
      languagesOk = Array.isArray(config.languages) && config.languages.length > 0;
    } catch {
      languagesOk = false;
    }
    if (!languagesOk) {
      gaps.push(
        gap({
          id: "languages.strategy",
          severity: "blocking",
          phase: "user",
          category: "languages",
          message: "Output paths use {lang} but docflow.config.json has no languages[].",
          questionForUser:
            "Which languages should generated documents support? (configure docflow.config.json languages[] to match {lang} in outputs)",
          fix: "npx ai-spector lang add en (and other codes)",
          path: ".ai-spector/docflow.config.json",
        }),
      );
    }
  }

  const skillGated = await readSkillGatedFlow(root, packName);
  if (!skillGated) {
    gaps.push(
      gap({
        id: "skill.gated-flow",
        severity: "blocking",
        phase: "agent",
        category: "skill",
        message: "Generate skill missing task gate / readiness / gated workflow sections.",
        questionForUser: undefined,
        fix: `Update .cursor/skills/ai-spector-generate-${packName}/SKILL.md — include Step 0 task_list and context-readiness`,
        path: `.cursor/skills/ai-spector-generate-${packName}/SKILL.md`,
      }),
    );
  }

  const { counts: graphDomainCounts, graphLoaded } = await countGraphNodesByType(root);
  const perDomains = [
    ...new Set(manifest.documents.filter((d) => d.perDomain).map((d) => d.perDomain!)),
  ];
  let graphPrereqsMet = perDomains.length === 0;
  if (perDomains.length > 0) {
    if (!graphLoaded) {
      gaps.push(
        gap({
          id: "graph.missing",
          severity: "blocking",
          phase: "user",
          category: "graph",
          message: "Traceability graph not found — run analyze + index first.",
          questionForUser:
            "Has the data source been analyzed? We need a knowledge graph before generating breakout documents.",
          fix: "Analyze docs/data-source → npx ai-spector index",
          path: ".ai-spector/graph/traceability.graph.json",
        }),
      );
    } else {
      graphPrereqsMet = true;
      for (const domain of perDomains) {
        const count = graphDomainCounts[domain as NodeType] ?? graphDomainCounts[domain] ?? 0;
        if (count === 0) {
          graphPrereqsMet = false;
          gaps.push(
            gap({
              id: `graph.domain.${domain}`,
              severity: "blocking",
              phase: "user",
              category: "graph",
              message: `Graph has 0 nodes of type "${domain}" required for breakout generation.`,
              questionForUser: `List the ${domain} items to include (ids + titles), or run data-source analyze so they appear in the graph.`,
              fix: `npx ai-spector index after updating knowledge.json with ${domain} entities`,
            }),
          );
        }
      }
    }
  } else if (!graphLoaded) {
    gaps.push(
      gap({
        id: "graph.prerequisites",
        severity: "should-ask",
        phase: "user",
        category: "graph",
        message: "No traceability graph yet — recommended before first generate.",
        questionForUser: "Is docs/data-source ready to analyze? Run analyze + index before generating.",
        fix: "npx ai-spector index",
      }),
    );
  }

  const contextStorePath = join(root, ".ai-spector", ".docflow", "context", `${docType}.json`);
  if (!(await pathExists(contextStorePath))) {
    gaps.push(
      gap({
        id: "context-store.missing",
        severity: "blocking",
        phase: "agent",
        category: "context-store",
        message: `Context store file missing for docType "${docType}".`,
        fix: `npx ai-spector template use ${packName}`,
        path: `.ai-spector/.docflow/context/${docType}.json`,
      }),
    );
  }

  const setupPath = join(packDir, "pack-setup.json");
  const storedSetup = (await pathExists(setupPath))
    ? await readJson<PackSetupState>(setupPath).catch(() => null)
    : null;
  const readinessReviewed = storedSetup?.items.find((i) => i.id === "readiness.reviewed")?.done ?? false;
  if (!readinessReviewed) {
    gaps.push(
      gap({
        id: "readiness.reviewed",
        severity: "blocking",
        phase: "user",
        category: "readiness",
        message: "User has not confirmed readiness-criteria.json review.",
        questionForUser:
          "Please review readiness-criteria.json — are blocking criteria correct for your domain? Any criteria to add or downgrade?",
        fix: `Mark readiness.reviewed done in pack-setup.json after review`,
        path: `.ai-spector/packs/${packName}/readiness-criteria.json`,
      }),
    );
  }

  const packContextReviewed =
    storedSetup?.items.find((i) => i.id === "pack-context.reviewed")?.done ?? false;
  if (!packContextReviewed && artifacts["pack-context/"]) {
    gaps.push(
      gap({
        id: "pack-context.reviewed",
        severity: "should-ask",
        phase: "agent",
        category: "pack-context",
        message: "pack-context/*.md guides not confirmed reviewed.",
        questionForUser: undefined,
        fix: "Review pack-context/*.md and mark pack-context.reviewed in pack-setup.json",
      }),
    );
  }

  const detected: Record<string, boolean> = {
    "manifest.purpose": Boolean(manifest.purpose?.trim()),
    "manifest.standards": Boolean(manifest.standards?.length),
    "manifest.docType": Boolean(docType),
    "manifest.outputs": manifest.documents.every((d) => d.output || d.outputPattern),
    "context-map.resolved": contextMapTodos.length === 0,
    "skill.gated-flow": skillGated,
    "languages.strategy": languagesOk,
    "graph.prerequisites": graphPrereqsMet && graphLoaded,
    "readiness.reviewed": readinessReviewed,
    "pack-context.reviewed": packContextReviewed,
    "verify.inspect": true,
  };

  if (opts.syncSetup) {
    const freshSetup = buildPackSetupState(manifest, undefined, contextMap, {
      skillIncludesGatedFlow: skillGated,
    });
    const merged = mergeSetupWithValidation(freshSetup, {
      ...detected,
      "readiness.reviewed": readinessReviewed,
      "pack-context.reviewed": packContextReviewed,
      "readiness.domain": storedSetup?.items.find((i) => i.id === "readiness.domain")?.done ?? false,
    });
    const { writeJson } = await import("../util/fs.js");
    await writeJson(setupPath, merged);
  }

  const blocking = gaps.filter((g) => g.severity === "blocking");
  const shouldAsk = gaps.filter((g) => g.severity === "should-ask");
  const questionsForUser = [
    ...blocking.filter((g) => g.questionForUser).map((g) => g.questionForUser!),
    ...shouldAsk.filter((g) => g.questionForUser).map((g) => g.questionForUser!),
  ];

  return {
    packName,
    ready: blocking.length === 0,
    blockingCount: blocking.length,
    shouldAskCount: shouldAsk.length,
    gaps,
    questionsForUser,
    contextMapTodos,
    graphDomainCounts,
    artifacts,
    setupStatus: blocking.length === 0 ? "ready" : "incomplete",
  };
}
