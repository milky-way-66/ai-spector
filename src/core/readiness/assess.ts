import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { runContextList } from "../operations/context.js";
import { pathExists, readJson } from "../util/fs.js";
import { loadMergedReadinessCriteria } from "./resolve.js";
import { checkStandardsAlignment } from "./standards-align.js";
import { countNodesByType, evaluateCriterion, type ProbeInventory } from "./probes.js";
import type {
  ReadinessAssessResult,
  ReadinessAssessSummary,
  ReadinessCriterion,
  ReadinessCriterionResult,
  ReadinessCriteriaFile,
} from "./types.js";

export interface ReadinessAssessOptions {
  root?: string;
  docType?: string;
  profile?: string;
  /** DAG node ids in scope, e.g. srs.3-use-cases */
  targets?: string[];
  /** Assess all targets in criteria file */
  targetAll?: boolean;
}

function collectCriteriaInScope(
  criteria: ReadinessCriteriaFile,
  dagNodes: string[],
  targetAll: boolean,
): Array<{ scope: "global" | string; criterion: ReadinessCriterion }> {
  const items: Array<{ scope: "global" | string; criterion: ReadinessCriterion }> = [];

  for (const c of criteria.globalCriteria ?? []) {
    items.push({ scope: "global", criterion: c });
  }

  const targetSet = new Set(dagNodes);
  for (const target of criteria.targets ?? []) {
    if (targetAll || targetSet.has(target.dagNode)) {
      for (const c of target.criteria ?? []) {
        items.push({ scope: target.dagNode, criterion: c });
      }
    }
  }

  return items;
}

function buildSummary(results: ReadinessCriterionResult[]): ReadinessAssessSummary {
  const summary: ReadinessAssessSummary = {
    total: results.length,
    met: 0,
    partial: 0,
    missing: 0,
    stale: 0,
    blockingTotal: 0,
    blockingMet: 0,
    blockingMissing: 0,
    shouldAskMissing: 0,
  };
  for (const r of results) {
    if (r.status === "met") summary.met += 1;
    else if (r.status === "partial") summary.partial += 1;
    else if (r.status === "stale") summary.stale += 1;
    else summary.missing += 1;

    if (r.severity === "blocking") {
      summary.blockingTotal += 1;
      if (r.status === "met") summary.blockingMet += 1;
      else summary.blockingMissing += 1;
    }
    if (r.severity === "should-ask" && r.status !== "met") {
      summary.shouldAskMissing += 1;
    }
  }
  return summary;
}

async function countDataSourceFiles(root: string): Promise<number> {
  const dir = join(root, "docs", "data-source");
  if (!(await pathExists(dir))) return 0;
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.startsWith(".")).length;
  } catch {
    return 0;
  }
}

async function countAnalysisGaps(root: string): Promise<number> {
  const gapsPath = join(root, ".ai-spector/.docflow/analysis/gaps.json");
  if (!(await pathExists(gapsPath))) return 0;
  const gaps = await readJson<{ gaps?: unknown[] }>(gapsPath).catch(() => ({ gaps: [] }));
  return Array.isArray(gaps.gaps) ? gaps.gaps.length : 0;
}

function buildRequirementQualitySummary(
  criteria: ReadinessCriteriaFile,
  inventory: ProbeInventory,
): ReadinessAssessResult["requirementQuality"] | undefined {
  const rq = criteria.requirementQuality as
    | { individualCharacteristics?: Array<{ id?: string; name?: string; check?: string } | string> }
    | undefined;
  if (!rq?.individualCharacteristics?.length) return undefined;

  const frCount = inventory.nodeCounts.requirement ?? 0;
  const total = rq.individualCharacteristics.length;
  const addressable = frCount > 0 ? Math.min(total, Math.floor(total * 0.6) + 2) : 0;
  const gaps: string[] = [];
  if (frCount === 0) gaps.push("No FR/requirement nodes — RQ characteristics not assessable from graph");
  if ((inventory.nodeCounts.nfr ?? 0) === 0) gaps.push("No NFR nodes for quality-attribute criteria");

  return {
    note: "Heuristic from graph FR/NFR counts; confirm per FR during clarify",
    addressableFromGraph: addressable,
    totalCharacteristics: total,
    gaps: gaps.length ? gaps : undefined,
  };
}

export async function assessReadiness(opts: ReadinessAssessOptions): Promise<ReadinessAssessResult> {
  const resolved = await loadMergedReadinessCriteria({
    root: opts.root,
    docType: opts.docType,
    profile: opts.profile,
  });

  const { root, config, criteria, profileId, criteriaPath, packName, docType } = resolved;
  const graphPath = join(root, config.paths.graph);
  let graph = null;
  if (await pathExists(graphPath)) {
    graph = await loadInMemoryGraph(graphPath);
  }

  const contextDocType = docType === "srs" ? "srs" : (packName ?? docType);
  const contextResult = await runContextList({ root, docType: contextDocType });
  const contextEntries = contextResult.stores.flatMap((s) => s.entries);

  const nodeCounts = countNodesByType(graph);
  const inventory: ProbeInventory = {
    graph,
    nodeCounts,
    contextEntries,
    dataSourceFiles: await countDataSourceFiles(root),
    analysisGaps: await countAnalysisGaps(root),
  };

  const targetAll = Boolean(opts.targetAll) || !opts.targets?.length;
  const dagNodes =
    opts.targets?.length && !opts.targetAll
      ? opts.targets
      : (criteria.targets ?? []).map((t) => t.dagNode);

  const scoped = collectCriteriaInScope(criteria, dagNodes, targetAll);
  const results: ReadinessCriterionResult[] = scoped.map(({ scope, criterion }) => {
    const probe = evaluateCriterion(criterion, inventory);
    return {
      id: criterion.id,
      scope,
      dimension: criterion.dimension,
      severity: criterion.severity,
      status: probe.status,
      question: criterion.question,
      iso29148: criterion.iso29148,
      field: criterion.field,
      evidence: probe.evidence,
      gap: probe.gap,
      graphCount: probe.graphCount,
      contextEntryId: probe.contextEntryId,
      acceptAssumption: criterion.acceptAssumption,
    };
  });

  const summary = buildSummary(results);
  const blockingGaps = results.filter(
    (r) => r.severity === "blocking" && r.status !== "met",
  );

  const questionsForUser: string[] = [];
  for (const r of blockingGaps) {
    questionsForUser.push(r.gap ? `${r.question} (${r.gap})` : r.question);
  }
  for (const r of results) {
    if (r.severity === "should-ask" && r.status !== "met") {
      questionsForUser.push(r.question);
    }
  }

  const standardsAlignment = checkStandardsAlignment(
    config.readiness?.standards,
    criteria.standards,
  );

  return {
    ready: summary.blockingMissing === 0,
    docType,
    packName,
    profile: profileId,
    appliedProfiles: resolved.appliedProfiles,
    criteriaPath,
    standardsAlignment,
    scope: { dagNodes: targetAll ? dagNodes : (opts.targets ?? dagNodes), targetAll },
    summary,
    requirementQuality: buildRequirementQualitySummary(criteria, inventory),
    criteria: results,
    blockingGaps,
    questionsForUser,
    inventory: {
      graphLoaded: graph != null,
      nodeCounts,
      totalNodes: graph?.nodesById.size ?? 0,
      contextOpen: contextEntries.filter((e) => e.status === "open").length,
      contextAnswered: contextEntries.filter((e) => e.status === "answered").length,
      contextStale: contextEntries.filter((e) => e.status === "stale").length,
      dataSourceFiles: inventory.dataSourceFiles,
      analysisGaps: inventory.analysisGaps,
    },
  };
}
