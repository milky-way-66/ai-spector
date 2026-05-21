import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildSectionRegistry } from "../registry/build.js";
import { bootstrapFromRegistry } from "./bootstrap.js";
import { validateGraph, formatIssues } from "./validate.js";
import { runGraphMerge } from "./graph-merge.js";
import { runGraphifyUpdate } from "./graphify-update.js";
import {
  knowledgeStaleWarning,
  runDocSemanticMerge,
} from "../index/doc-semantics.js";
import { resolveProjectPaths } from "../util/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { loadDocflowConfig } from "../config/load.js";
import {
  knowledgeHasDomainEntries,
  type AnalysisKnowledge,
  isKnowledgePayload,
} from "../graph/knowledge.js";
import { computeKnowledgeStats } from "../visualize/stats.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import type { TraceabilityGraph } from "../types.js";
import {
  indexDocsConfigPath,
  type IndexDocsConfig,
} from "../index/docs-config.js";
import {
  buildDocIndex,
  computeIndexSourceHash,
  discoverMarkdownFiles,
} from "../index/docs-build.js";

export type IndexStepStatus = "ok" | "skipped" | "failed";

export interface IndexStepResult {
  id: string;
  label: string;
  status: IndexStepStatus;
  detail?: string;
}

export interface IndexOptions {
  root?: string;
  graphOnly?: boolean;
  docsOnly?: boolean;
  skipGraphify?: boolean;
  skipDocs?: boolean;
  skipMerge?: boolean;
  skipDocSemantics?: boolean;
  skipValidate?: boolean;
  /** Re-run Graphify on all sources even when content hash unchanged */
  forceGraphify?: boolean;
}

export interface IndexReport {
  steps: IndexStepResult[];
  failed: boolean;
}

export async function runIndex(
  opts: IndexOptions = {},
): Promise<IndexReport> {
  const paths = await resolveProjectPaths(opts.root);
  const { root: projectRoot } = await loadDocflowConfig(opts.root);
  const steps: IndexStepResult[] = [];
  let failed = false;

  const record = (step: IndexStepResult) => {
    steps.push(step);
    if (step.status === "failed") {
      failed = true;
    }
  };

  const graphOnly = opts.graphOnly === true;
  const docsOnly = opts.docsOnly === true;
  if (graphOnly && docsOnly) {
    throw new Error("Use only one of --graph-only or --docs-only");
  }

  const runGraph = !docsOnly;
  const runDocs = !graphOnly && !opts.skipDocs;
  const runGraphify = runGraph && !graphOnly && !opts.skipGraphify;

  let graphJson: TraceabilityGraph | null = null;

  if (runGraph) {
    try {
      const registry = await buildSectionRegistry(projectRoot);
      await writeJson(paths.registry, registry);
      const total = registry.documents.reduce((n, d) => n + d.sections.length, 0);
      const graph = bootstrapFromRegistry(registry);
      await writeJson(paths.graph, graph.toTraceabilityGraph());
      graphJson = graph.toTraceabilityGraph();

      const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
      const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
        version: 1,
        analysis: {},
        index: {},
      }));
      const analysis = (state.analysis as Record<string, unknown>) ?? {};
      analysis.graphPreparedAt = new Date().toISOString();
      analysis.indexRefreshedAt = new Date().toISOString();
      state.analysis = analysis;
      await writeJson(statePath, state);

      record({
        id: "graph-structure",
        label: "Traceability graph structure",
        status: "ok",
        detail: `${registry.documents.length} documents, ${total} sections → ${paths.graph}`,
      });
    } catch (err) {
      record({
        id: "graph-structure",
        label: "Traceability graph structure",
        status: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    if (!opts.skipMerge && !failed) {
      const knowledgePath = join(
        projectRoot,
        ".ai-spector/.docflow/analysis/knowledge.json",
      );
      try {
        if (!(await pathExists(knowledgePath))) {
          record({
            id: "knowledge-merge",
            label: "Knowledge → graph merge",
            status: "skipped",
            detail: `No ${knowledgePath} — run /analyze in Cursor to extract knowledge first`,
          });
        } else {
          const raw = await readJson<unknown>(knowledgePath);
          if (!isKnowledgePayload(raw) || !knowledgeHasDomainEntries(raw as AnalysisKnowledge)) {
            record({
              id: "knowledge-merge",
              label: "Knowledge → graph merge",
              status: "skipped",
              detail: "knowledge.json has no domain entries yet",
            });
          } else {
            await runGraphMerge({
              root: projectRoot,
              fromKnowledge: true,
              graphPath: paths.graph,
              validate: false,
            });
            graphJson = await readJson<TraceabilityGraph>(paths.graph);
            const ks = computeKnowledgeStats(raw as AnalysisKnowledge);
            record({
              id: "knowledge-merge",
              label: "Knowledge → graph merge",
              status: "ok",
              detail: `${ks.useCases} use cases, ${ks.features} features, ${ks.actors} actors merged`,
            });
          }
        }
      } catch (err) {
        record({
          id: "knowledge-merge",
          label: "Knowledge → graph merge",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (opts.skipMerge) {
      record({
        id: "knowledge-merge",
        label: "Knowledge → graph merge",
        status: "skipped",
        detail: "--skip-merge",
      });
      if (!failed) {
        try {
          graphJson = (await loadInMemoryGraph(paths.graph)).toTraceabilityGraph();
        } catch {
          graphJson = null;
        }
      }
    }

    if (!opts.skipDocSemantics && !failed) {
      try {
        const docResult = await runDocSemanticMerge({
          projectRoot,
          graphPath: paths.graph,
        });
        if (docResult.merged) {
          graphJson = await readJson<TraceabilityGraph>(paths.graph);
          const stale = await knowledgeStaleWarning(projectRoot, docResult.sourceHashes);
          record({
            id: "docs-semantic-merge",
            label: "SRS/docs → graph (body extract)",
            status: "ok",
            detail: stale ? `${docResult.detail}\n      ⚠ ${stale}` : docResult.detail,
          });
        } else {
          record({
            id: "docs-semantic-merge",
            label: "SRS/docs → graph (body extract)",
            status: "skipped",
            detail: docResult.detail,
          });
        }
      } catch (err) {
        record({
          id: "docs-semantic-merge",
          label: "SRS/docs → graph (body extract)",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (opts.skipDocSemantics) {
      record({
        id: "docs-semantic-merge",
        label: "SRS/docs → graph (body extract)",
        status: "skipped",
        detail: "--skip-doc-semantics",
      });
    }

    if (runGraphify && !failed) {
      try {
        const gf = await runGraphifyUpdate({
          root: projectRoot,
          force: opts.forceGraphify,
        });
        const runDetail =
          gf.sourcesRun.length > 0
            ? `updated: ${gf.sourcesRun.join(", ")}`
            : "no source changes";
        const skipDetail =
          gf.sourcesSkipped.length > 0
            ? `; unchanged: ${gf.sourcesSkipped.join(", ")}`
            : "";
        record({
          id: "graphify-storage",
          label: "Graphify index & graph.json",
          status: "ok",
          detail: `${runDetail}${skipDetail}`,
        });
      } catch (err) {
        record({
          id: "graphify-storage",
          label: "Graphify index & graph.json",
          status: "failed",
          detail:
            (err instanceof Error ? err.message : String(err)) +
            " (retry with graphify installed, or use --skip-graphify)",
        });
      }
    } else if (!runGraphify) {
      record({
        id: "graphify-storage",
        label: "Graphify index & graph.json",
        status: "skipped",
        detail: opts.skipGraphify ? "--skip-graphify" : "graph-only / docs-only",
      });
    }

    if (!opts.skipValidate && !failed) {
      try {
        const issues = await validateGraph({
          graphPath: paths.graph,
          schemaPath: paths.schema,
          registryPath: paths.registry,
          rulesPath: paths.rulesTraceability,
        });
        const errors = issues.filter((i) => i.severity === "error");
        if (errors.length > 0) {
          record({
            id: "graph-validate",
            label: "Graph validate",
            status: "failed",
            detail: formatIssues(errors).trim(),
          });
        } else {
          const warns = issues.filter((i) => i.severity === "warn").length;
          record({
            id: "graph-validate",
            label: "Graph validate",
            status: "ok",
            detail: warns > 0 ? `OK (${warns} warnings)` : "OK",
          });
        }
      } catch (err) {
        record({
          id: "graph-validate",
          label: "Graph validate",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      record({
        id: "graph-validate",
        label: "Graph validate",
        status: "skipped",
        detail: opts.skipValidate ? "--skip-validate" : "prior step failed",
      });
    }
  }

  if (runDocs) {
    const configPath = indexDocsConfigPath(projectRoot);
    try {
      if (!(await pathExists(configPath))) {
        record({
          id: "docs-index",
          label: "Document indexes (.ai-spector/index/)",
          status: "skipped",
          detail: `Missing ${configPath} — run ai-spector init`,
        });
      } else {
        const config = await readJson<IndexDocsConfig>(configPath);
        if (!graphJson) {
          try {
            graphJson = (await loadInMemoryGraph(paths.graph)).toTraceabilityGraph();
          } catch {
            graphJson = null;
          }
        }
        const indexedAt = new Date().toISOString();
        const hashes: Record<string, string> = {};

        for (const kind of ["srs", "basicDesign"] as const) {
          const sourceKey = kind === "srs" ? "srs" : "basicDesign";
          const source = config.sources[sourceKey];
          if (!source) {
            continue;
          }
          const files = await discoverMarkdownFiles(
            projectRoot,
            source.root,
            source.glob ?? "**/*.md",
          );
          hashes[sourceKey] = computeIndexSourceHash(files);
          const built = await buildDocIndex({
            kind,
            config,
            projectRoot,
            files,
            graph: graphJson,
            indexedAt,
          });
          const outPath = join(projectRoot, config.outputs[sourceKey]);
          await mkdir(dirname(outPath), { recursive: true });
          await writeFile(outPath, built.markdown, "utf8");
        }

        const statePath = join(projectRoot, ".ai-spector/.docflow/state.json");
        const state = await readJson<Record<string, unknown>>(statePath).catch(() => ({
          version: 1,
          index: {},
        }));
        const indexState = (state.index as Record<string, unknown>) ?? {};
        indexState.lastRunAt = indexedAt;
        indexState.sourceHashes = hashes;
        state.index = indexState;
        await writeJson(statePath, state);

        record({
          id: "docs-index",
          label: "Document indexes (.ai-spector/index/)",
          status: "ok",
          detail: `srs hash ${hashes.srs ?? "—"}, basic-design hash ${hashes.basicDesign ?? "—"}`,
        });
      }
    } catch (err) {
      record({
        id: "docs-index",
        label: "Document indexes (.ai-spector/index/)",
        status: "failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    record({
      id: "docs-index",
      label: "Document indexes (.ai-spector/index/)",
      status: "skipped",
      detail: graphOnly || opts.skipDocs ? "--graph-only or --skip-docs" : "docs-only graph skipped",
    });
  }

  printIndexSummary(steps, failed);

  if (failed) {
    const first = steps.find((s) => s.status === "failed");
    throw new Error(
      `Index refresh incomplete${first ? ` (${first.label})` : ""}. Fix errors above and re-run: ai-spector index`,
    );
  }

  return { steps, failed };
}

function printIndexSummary(steps: IndexStepResult[], failed: boolean): void {
  console.log("");
  console.log("Index refresh summary");
  console.log("─────────────────────");
  for (const s of steps) {
    const icon = s.status === "ok" ? "✓" : s.status === "skipped" ? "○" : "✗";
    console.log(`  ${icon} ${s.label}: ${s.status}`);
    if (s.detail) {
      for (const line of s.detail.split("\n")) {
        console.log(`      ${line}`);
      }
    }
  }
  console.log("");
  if (failed) {
    console.log("Some steps failed. Graph/knowledge may be partially updated.");
    console.log("Re-run after fixing, or use flags: --skip-graphify, --skip-merge, --graph-only");
  } else {
    console.log("All requested steps completed.");
    console.log(
      "Full semantic re-extract (actors, NFRs, data model) still uses /analyze + Graphify MCP → knowledge.json.",
    );
    console.log(
      "Index merges existing knowledge plus UC/F/actor ids parsed from docs/srs and docs/basic-design bodies.",
    );
  }
}
