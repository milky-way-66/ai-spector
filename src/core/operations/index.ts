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
import {
  applyPrimaryLanguageOutputs,
  primaryDocumentNodes,
  wireTranslationDocNode,
} from "../graph/translation.js";
import type { TraceabilityGraph } from "@/types.js";
import {
  indexDocsConfigPath,
  type IndexDocsConfig,
} from "../index/docs-config.js";
import {
  buildDocIndex,
  computeIndexSourceHash,
  discoverDocSourceFiles,
  discoverMarkdownFiles,
  DOC_INDEX_DEFAULT_OUTPUTS,
  DOC_INDEX_DEFAULT_ROOTS,
} from "../index/docs-build.js";
import { reconcileTranslationQueue } from "../lang/queue.js";
import { reconcileReviews } from "../reviews/reconcile.js";
import { runContextStaleScan } from "./context.js";

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
  cocoindexSync?: boolean;
}

export interface IndexSources {
  dataSource: boolean;
  srs: boolean;
  basicDesign: boolean;
  knowledgeExtracted: boolean;
}

export interface IndexReport {
  steps: IndexStepResult[];
  failed: boolean;
  sources: IndexSources;
  /** Agent guidance: what to do after this run (analyze data source, generate SRS, or nothing). */
  nextAction?: string;
  cocoindexUpdated?: boolean;
  cocoindexSkipped?: boolean;
  reviewQueue?: { scanned: number; invalidated: number; alreadyPending: number; errors: number };
}

async function detectIndexSources(
  projectRoot: string,
  config?: IndexDocsConfig,
): Promise<IndexSources> {
  const hasFiles = async (kind: "srs" | "basicDesign" | "dataSource") => {
    const root = config?.sources[kind]?.root ?? DOC_INDEX_DEFAULT_ROOTS[kind];
    const files = await discoverMarkdownFiles(projectRoot, root, "**/*.md").catch(() => []);
    return files.length > 0;
  };
  const knowledgePath = join(projectRoot, ".ai-spector/.docflow/analysis/knowledge.json");
  let knowledgeExtracted = false;
  if (await pathExists(knowledgePath)) {
    const raw = await readJson<unknown>(knowledgePath).catch(() => null);
    knowledgeExtracted =
      raw !== null && isKnowledgePayload(raw) && knowledgeHasDomainEntries(raw as AnalysisKnowledge);
  }
  return {
    dataSource: await hasFiles("dataSource"),
    srs: await hasFiles("srs"),
    basicDesign: await hasFiles("basicDesign"),
    knowledgeExtracted,
  };
}

function indexNextAction(sources: IndexSources): string | undefined {
  if (sources.dataSource && !sources.knowledgeExtracted) {
    return "Data source found but no extracted knowledge — analyze docs/data-source/ (agent skill writes analysis/knowledge.json), then re-run index.";
  }
  if (!sources.srs) {
    return "No SRS documents yet — stop after analysis. Generate the SRS next, then re-run index.";
  }
  return undefined;
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

  const docsConfigFile = indexDocsConfigPath(projectRoot);
  const docsConfig = (await pathExists(docsConfigFile))
    ? await readJson<IndexDocsConfig>(docsConfigFile).catch(() => undefined)
    : undefined;
  const sources = await detectIndexSources(projectRoot, docsConfig);
  const mark = (v: boolean) => (v ? "✓" : "—");
  record({
    id: "source-detect",
    label: "Source detection",
    status: "ok",
    detail: `data-source ${mark(sources.dataSource)}, srs ${mark(sources.srs)}, basic-design ${mark(sources.basicDesign)}, knowledge.json ${mark(sources.knowledgeExtracted)}`,
  });

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
      const primary = primaryLanguage(docflowConfig);
      const allLangCodes = docflowConfig.languages.map((l) => l.code);
      applyPrimaryLanguageOutputs(graph, primary.code, allLangCodes);
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
          const allLangCodes = docflowConfig.languages.map((l) => l.code);
          const primaryDocNodes = primaryDocumentNodes(graphMem, allLangCodes);
          let added = 0;
          let updated = 0;
          for (const lang of secondaryLangs) {
            for (const docNode of primaryDocNodes) {
              const outcome = wireTranslationDocNode(
                graphMem,
                docNode,
                lang,
                primary.code,
              );
              if (outcome === "created") added++;
              else updated++;
            }
          }
          await writeJson(paths.graph, graphMem.toTraceabilityGraph());
          graphJson = graphMem.toTraceabilityGraph();
          const detailParts = [`${secondaryLangs.map((l) => l.code).join(", ")}`];
          if (added > 0) detailParts.push(`${added} node(s) added`);
          if (updated > 0) detailParts.push(`${updated} refreshed`);
          record({
            id: "language-nodes",
            label: "Multi-language translation nodes",
            status: "ok",
            detail: detailParts.join(" — "),
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
        const fileCounts: Record<string, number> = {};

        for (const kind of ["srs", "basicDesign", "dataSource"] as const) {
          const sourceKey = kind;
          // dataSource may be absent from older configs — fall back to the
          // conventional root so existing projects get indexed without migration.
          const source =
            config.sources[sourceKey] ??
            (kind === "dataSource"
              ? { root: DOC_INDEX_DEFAULT_ROOTS.dataSource }
              : undefined);
          if (!source) {
            continue;
          }

          // Single discovery contract: scan source.root recursively with source.glob.
          // Per-language folders (en/, vi/) and flat legacy layouts are both just
          // nested paths — the semantic merge uses the same walk, so hashes match.
          const allFiles = await discoverDocSourceFiles(projectRoot, source).catch(
            () => [],
          );

          hashes[sourceKey] = computeIndexSourceHash(allFiles);
          fileCounts[sourceKey] = allFiles.length;
          const built = await buildDocIndex({
            kind,
            config,
            projectRoot,
            files: allFiles,
            graph: graphJson,
            indexedAt,
          });
          const outPath = join(
            projectRoot,
            config.outputs[sourceKey] ?? DOC_INDEX_DEFAULT_OUTPUTS[kind],
          );
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
          detail: `srs ${fileCounts.srs ?? 0} files (hash ${hashes.srs ?? "—"}), basic-design ${fileCounts.basicDesign ?? 0} files (hash ${hashes.basicDesign ?? "—"}), data-source ${fileCounts.dataSource ?? 0} files (hash ${hashes.dataSource ?? "—"})`,
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

  try {
    const queueResult = await reconcileTranslationQueue(projectRoot, docflowConfig);
    if (queueResult.skipped) {
      record({
        id: "translation-queue",
        label: "Translation queue",
        status: "skipped",
        detail: queueResult.skipReason ?? "single language",
      });
    } else {
      record({
        id: "translation-queue",
        label: "Translation queue",
        status: "ok",
        detail: `${queueResult.pendingCount} pending, +${queueResult.enqueued} enqueued, ${queueResult.resolved} resolved, ${queueResult.failed} failed`,
      });
    }
  } catch (err) {
    record({
      id: "translation-queue",
      label: "Translation queue",
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  let reviewQueueSummary: IndexReport["reviewQueue"];
  try {
    const rr = await reconcileReviews(projectRoot);
    reviewQueueSummary = {
      scanned: rr.scanned,
      invalidated: rr.invalidated,
      alreadyPending: rr.alreadyPending,
      errors: rr.errors.length,
    };
    if (rr.scanned === 0) {
      record({
        id: "review-queue",
        label: "Review queue",
        status: "skipped",
        detail: "no approval records yet — run review approve to initialise",
      });
    } else {
      const parts = [`${rr.scanned} scanned`];
      if (rr.invalidated > 0) parts.push(`+${rr.invalidated} invalidated`);
      if (rr.alreadyPending > 0) parts.push(`${rr.alreadyPending} already pending`);
      if (rr.errors.length > 0) parts.push(`${rr.errors.length} error(s)`);
      record({
        id: "review-queue",
        label: "Review queue",
        status: "ok",
        detail: rr.errors.length > 0 ? `${parts.join(", ")} (${rr.errors.length} path error(s) skipped)` : parts.join(", "),
      });
    }
  } catch (err) {
    record({
      id: "review-queue",
      label: "Review queue",
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const scan = await runContextStaleScan({ root: projectRoot });
    if (scan.docTypes.length === 0) {
      record({
        id: "context-staleness",
        label: "Context store staleness",
        status: "skipped",
        detail: "no context stores yet",
      });
    } else {
      const parts = [`${scan.checked} answered entr${scan.checked === 1 ? "y" : "ies"} checked`];
      if (scan.markedStale > 0) parts.push(`${scan.markedStale} marked stale`);
      if (scan.staleTotal > 0) {
        parts.push(`${scan.staleTotal} stale total — re-confirm via clarify before next generate`);
      }
      record({
        id: "context-staleness",
        label: "Context store staleness",
        status: "ok",
        detail: parts.join(", "),
      });
    }
  } catch (err) {
    record({
      id: "context-staleness",
      label: "Context store staleness",
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (failed) {
    const first = steps.find((s) => s.status === "failed");
    throw new Error(
      `Index refresh incomplete${first ? ` (${first.label})` : ""}. Fix errors above and re-run: npx ai-spector index`,
    );
  }

  // CocoIndex auto-sync (opt-in via cocoindexSync option or config flag)
  const { isCocoindexConfigured, cocoindexPipelinePath } = await import("./cocoindex.js");
  const { loadDocflowConfig: reloadConfig } = await import("../config/load.js");

  let cocoindexUpdated: boolean | undefined;
  let cocoindexSkipped: boolean | undefined;

  const configured = await isCocoindexConfigured(projectRoot);
  if (!configured) {
    cocoindexSkipped = true;
  } else {
    let autoSync = opts.cocoindexSync ?? false;
    if (!autoSync) {
      try {
        const { config } = await reloadConfig(projectRoot);
        autoSync = (config as unknown as { cocoindex?: { autoSync?: boolean } }).cocoindex?.autoSync === true;
      } catch {
        // config reload failed — skip
      }
    }

    if (!autoSync) {
      cocoindexSkipped = true;
    } else {
      try {
        const { findPython, cocoindexDir } = await import("./cocoindex.js");
        const cocoDir = cocoindexDir(projectRoot);
        const pipelinePath = cocoindexPipelinePath(projectRoot);
        const pythonBin = await findPython(cocoDir);
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const exec = promisify(execFile);
        await exec(pythonBin, [pipelinePath, "update"], {
          cwd: cocoDir,
          env: {
            ...process.env,
            AI_SPECTOR_ROOT: projectRoot,
            COCOINDEX_DB: join(cocoDir, "cocoindex_state"),
          },
        });
        cocoindexUpdated = true;
      } catch (err) {
        let msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg)) {
          msg +=
            "\nLikely cause: the same doc root is mounted twice in .ai-spector/.docflow/cocoindex/flow.py " +
            "(index.docs.json sources + hardcoded docs/data-source fallback). " +
            "Re-run `npx ai-spector cocoindex setup` to regenerate flow.py with deduplicated roots.";
        }
        steps.push({ id: "cocoindex-sync", label: "CocoIndex sync", status: "failed", detail: msg });
        cocoindexSkipped = true;
        // Explicitly requested sync that fails should fail the overall report,
        // otherwise callers relying on `failed` miss stale embeddings.
        if (opts.cocoindexSync) {
          failed = true;
        }
      }
    }
  }

  return {
    steps,
    failed,
    sources,
    nextAction: indexNextAction(sources),
    cocoindexUpdated,
    cocoindexSkipped,
    reviewQueue: reviewQueueSummary,
  };
}
