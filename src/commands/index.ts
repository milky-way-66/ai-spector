import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildSectionRegistry } from "../registry/build.js";
import { bootstrapFromRegistry } from "./bootstrap.js";
import { validateGraph, formatIssues } from "./validate.js";
import { runGraphMerge } from "./graph-merge.js";
import { runProvenanceLink } from "../graph/provenance.js";
import { ensureBusinessBundle, ensureSourceBundle } from "../graph/bundles.js";
import {
  knowledgeStaleWarning,
  runDocSemanticMerge,
} from "../index/doc-semantics.js";
import { resolveProjectPaths } from "../util/paths.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import { loadDocflowConfig, primaryLanguage } from "../config/load.js";
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
  skipDocs?: boolean;
  skipMerge?: boolean;
  skipDocSemantics?: boolean;
  skipValidate?: boolean;
}

export interface IndexReport {
  steps: IndexStepResult[];
  failed: boolean;
}

export async function runIndex(
  opts: IndexOptions = {},
): Promise<IndexReport> {
  const paths = await resolveProjectPaths(opts.root);
  const { root: projectRoot, config: docflowConfig } = await loadDocflowConfig(opts.root);
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

    if (!failed) {
      try {
        const primary = primaryLanguage(docflowConfig);
        const secondaryLangs = docflowConfig.languages.filter((l) => l.code !== primary.code);
        if (secondaryLangs.length > 0 && graphJson) {
          const graphMem = await loadInMemoryGraph(paths.graph);
          // Only select nodes that are not already translation nodes (ID does not start with "doc:{langCode}:")
          const translationPrefixes = docflowConfig.languages.map((l) => `doc:${l.code}:`);
          const primaryDocNodes = graphMem.toTraceabilityGraph().nodes.filter(
            (n) => n.type === "document" && !translationPrefixes.some((p) => n.id.startsWith(p)),
          );
          let added = 0;
          for (const lang of secondaryLangs) {
            for (const docNode of primaryDocNodes) {
              const translatedId = `doc:${lang.code}:${docNode.id}`;
              if (!graphMem.nodesById.has(translatedId)) {
                graphMem.addNode({ id: translatedId, type: "document", lang: lang.code, label: lang.label });
                added++;
              }
              // Check via inEdges on the primary node — avoids re-serializing the full edge list each iteration
              const inEdges = graphMem.inEdges.get(docNode.id) ?? [];
              const edgeExists = inEdges.some(
                (e) => e.type === "translationOf" && e.from === translatedId,
              );
              if (!edgeExists) {
                graphMem.addEdge({ type: "translationOf", from: translatedId, to: docNode.id });
              }
            }
          }
          await writeJson(paths.graph, graphMem.toTraceabilityGraph());
          graphJson = graphMem.toTraceabilityGraph();
          record({
            id: "language-nodes",
            label: "Multi-language translation nodes",
            status: "ok",
            detail: `${secondaryLangs.map((l) => l.code).join(", ")} — ${added} node(s) added`,
          });
        } else {
          record({
            id: "language-nodes",
            label: "Multi-language translation nodes",
            status: "skipped",
            detail: secondaryLangs.length === 0 ? "single-language project" : "no graph to annotate",
          });
        }
      } catch (err) {
        record({
          id: "language-nodes",
          label: "Multi-language translation nodes",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
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

    if (!failed) {
      try {
        const graphMem = await loadInMemoryGraph(paths.graph);
        const srcBundle = await ensureSourceBundle(graphMem, projectRoot);
        await writeJson(paths.graph, graphMem.toTraceabilityGraph());
        graphJson = graphMem.toTraceabilityGraph();
        record({
          id: "source-bundle",
          label: "Source hub (bundle.source)",
          status: "ok",
          detail: `${srcBundle.sourceFiles} source file node(s)`,
        });
      } catch (err) {
        record({
          id: "source-bundle",
          label: "Source hub (bundle.source)",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!failed) {
      try {
        const prov = await runProvenanceLink({
          projectRoot,
          graphPath: paths.graph,
        });
        if (prov.merged) {
          graphJson = await readJson<TraceabilityGraph>(paths.graph);
        }
        record({
          id: "provenance-link",
          label: "Data-source provenance (derivedFrom)",
          status: prov.merged ? "ok" : "skipped",
          detail: prov.detail,
        });
      } catch (err) {
        record({
          id: "provenance-link",
          label: "Data-source provenance (derivedFrom)",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!failed) {
      try {
        const graphMem = await loadInMemoryGraph(paths.graph);
        const biz = ensureBusinessBundle(graphMem);
        await writeJson(paths.graph, graphMem.toTraceabilityGraph());
        graphJson = graphMem.toTraceabilityGraph();
        record({
          id: "business-bundle",
          label: "Business hub (bundle.business)",
          status: "ok",
          detail: `${biz.domainMembers} domain member(s)`,
        });
      } catch (err) {
        record({
          id: "business-bundle",
          label: "Business hub (bundle.business)",
          status: "failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
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
          detail: `Missing ${configPath} — run npx ai-spector init`,
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

          // Collect files across all configured languages (docs/{type}/{lang.code}/**)
          // and fall back to the bare source root for projects that predate per-lang folders.
          const baseRoot = source.root; // e.g. "docs/srs"
          const langs = docflowConfig.languages;
          const allFiles: Awaited<ReturnType<typeof discoverMarkdownFiles>> = [];
          for (const lang of langs) {
            const langRoot = `${baseRoot}/${lang.code}`;
            const langFiles = await discoverMarkdownFiles(
              projectRoot,
              langRoot,
              source.glob ?? "**/*.md",
            ).catch(() => []);
            allFiles.push(...langFiles);
          }
          // Legacy fallback: scan base root directly only when no lang-scoped files exist
          // AND the base root itself contains .md files (pre-multi-lang project layout).
          if (allFiles.length === 0) {
            const legacyFiles = await discoverMarkdownFiles(
              projectRoot,
              baseRoot,
              source.glob ?? "**/*.md",
            ).catch(() => []);
            // Only use legacy files if they're not just .gitkeep or empty folders
            const mdFiles = legacyFiles.filter((f) => f.relativePath.endsWith(".md"));
            allFiles.push(...mdFiles);
          }

          hashes[sourceKey] = computeIndexSourceHash(allFiles);
          const built = await buildDocIndex({
            kind,
            config,
            projectRoot,
            files: allFiles,
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
      `Index refresh incomplete${first ? ` (${first.label})` : ""}. Fix errors above and re-run: npx ai-spector index`,
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
    console.log("Re-run after fixing, or use flags: --skip-merge, --graph-only");
  } else {
    console.log("All requested steps completed.");
    console.log(
      "Index merges existing knowledge.json plus UC/F/actor ids parsed from docs/srs and docs/basic-design bodies.",
    );
    console.log(
      "Full semantic re-extract (actors, NFRs, data model): run /analyze in Cursor → knowledge.json.",
    );
  }
}
