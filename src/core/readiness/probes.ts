import type { InMemoryGraph } from "../graph/InMemoryGraph.js";
import type { ContextEntry } from "../operations/context.js";
import type { DeriveLayer } from "../operations/derive.js";
import type { ReadinessCriterion, ReadinessStatus } from "./types.js";

export interface ProbeInventory {
  graph: InMemoryGraph | null;
  nodeCounts: Record<string, number>;
  contextEntries: ContextEntry[];
  dataSourceFiles: number;
  analysisGaps: number;
  deriveFrom?: DeriveLayer[];
  downstreamDocFiles?: number;
}

export interface ProbeResult {
  status: ReadinessStatus;
  evidence: string[];
  gap?: string;
  graphCount?: number;
  contextEntryId?: string;
}

export function countNodesByType(graph: InMemoryGraph | null): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!graph) return counts;
  for (const node of graph.nodesById.values()) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }
  return counts;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function findContextMatch(
  criterion: ReadinessCriterion,
  entries: ContextEntry[],
): ContextEntry | undefined {
  const q = normalize(criterion.question);
  const field = criterion.field ? normalize(criterion.field) : "";
  for (const entry of entries) {
    if (entry.status === "open") continue;
    const eq = normalize(entry.question);
    if (eq === q || eq.includes(q.slice(0, 40)) || q.includes(eq.slice(0, 40))) {
      return entry;
    }
    if (field && eq.includes(field)) return entry;
    if (criterion.id && entry.scope?.includes(criterion.id)) return entry;
  }
  for (const entry of entries) {
    if (entry.status === "open" && normalize(entry.question).includes(q.slice(0, 30))) {
      return entry;
    }
  }
  return undefined;
}

function inferNodeTypeFromProbe(probe: string, criterion: ReadinessCriterion): string | null {
  if (criterion.perEntity) return criterion.perEntity;
  const typeMatch = probe.match(/type\s*===\s*["'](\w+)["']/);
  if (typeMatch) return typeMatch[1]!;
  if (/\bactor\b/i.test(probe)) return "actor";
  if (/\buseCase\b|use case/i.test(probe)) return "useCase";
  if (/\bfeature\b/i.test(probe)) return "feature";
  if (/\bFR\b|functional requirement|requirement nodes/i.test(probe)) return "requirement";
  if (/\bNFR\b|quality/i.test(probe)) return "nfr";
  if (/\bcomponent\b|container\b|module\b|building block/i.test(probe)) return "component";
  if (/\binterface\b/i.test(probe)) return "interface";
  if (/\barchitectureDecision\b|\bADR\b|decision/i.test(probe)) return "architectureDecision";
  if (/\brisk\b/i.test(probe)) return "risk";
  if (/\bglossary\b/i.test(probe)) return "glossary";
  if (/\bsystem\b/i.test(probe)) return "system";
  return null;
}

function findSystemNode(graph: InMemoryGraph | null): { description?: string } | null {
  if (!graph) return null;
  for (const node of graph.nodesById.values()) {
    if (node.id === "system" || /(^|\.)system($|\.)/i.test(node.id)) {
      const props = node as { description?: string; name?: string };
      if (props.description || props.name) return props;
    }
  }
  for (const node of graph.nodesById.values()) {
    if (node.id.includes("system") || node.type === "section") {
      const props = node as { description?: string; name?: string };
      if (props.description || props.name) return props;
    }
  }
  return null;
}

function countEdgesOfTypes(graph: InMemoryGraph | null, types: string[]): number {
  if (!graph) return 0;
  const set = new Set(types);
  let n = 0;
  for (const list of graph.outEdges.values()) {
    for (const e of list) {
      if (set.has(e.type)) n += 1;
    }
  }
  return n;
}

export function evaluateCriterion(
  criterion: ReadinessCriterion,
  inventory: ProbeInventory,
): ProbeResult {
  const staleEntry = inventory.contextEntries.find(
    (e) => e.status === "stale" && normalize(e.question).includes(normalize(criterion.question).slice(0, 30)),
  );
  if (staleEntry) {
    return {
      status: "stale",
      evidence: [`context:${staleEntry.id}`],
      gap: "Prior answer is stale — re-confirm with user",
      contextEntryId: staleEntry.id,
    };
  }

  const answered = findContextMatch(
    criterion,
    inventory.contextEntries.filter((e) => e.status === "answered"),
  );
  if (answered?.answer) {
    return {
      status: "met",
      evidence: [`context:${answered.id}`, `source:${answered.source}`],
      contextEntryId: answered.id,
    };
  }

  const probe = criterion.graphProbe ?? "";
  const nodeType = inferNodeTypeFromProbe(probe, criterion);

  if (nodeType && criterion.minGraphCount != null) {
    const count = inventory.nodeCounts[nodeType] ?? 0;
    if (count >= criterion.minGraphCount) {
      return {
        status: "met",
        evidence: [`graph:${count} ${nodeType} node(s)`],
        graphCount: count,
      };
    }
    if (count > 0) {
      return {
        status: "partial",
        evidence: [`graph:${count} ${nodeType} node(s)`],
        gap: `Need at least ${criterion.minGraphCount}, found ${count}`,
        graphCount: count,
      };
    }
    return {
      status: "missing",
      evidence: [],
      gap: `No ${nodeType} nodes in graph (need ≥${criterion.minGraphCount})`,
      graphCount: 0,
    };
  }

  if (/system\.description|system root/i.test(probe)) {
    const system = findSystemNode(inventory.graph);
    if (system?.description) {
      return { status: "met", evidence: ["system.description"] };
    }
    if (system) {
      return {
        status: "partial",
        evidence: ["system node exists"],
        gap: "System node lacks description",
      };
    }
  }

  if (/satisfies|verifies|mitigates|traceab/i.test(probe)) {
    const edgeCount = countEdgesOfTypes(inventory.graph, ["satisfies", "verifies", "mitigates", "tracesTo"]);
    if (edgeCount > 0) {
      return { status: "met", evidence: [`graph:${edgeCount} traceability edge(s)`] };
    }
  }

  if (criterion.graphProbe === "downstreamDocsIndexed") {
    const count = inventory.downstreamDocFiles ?? 0;
    if (count > 0) {
      return { status: "met", evidence: [`downstream-docs:${count} file(s)`] };
    }
    const layers = inventory.deriveFrom?.join(", ") ?? "basic-design, detail-design";
    return {
      status: "missing",
      evidence: [],
      gap: `No markdown under ${layers}`,
    };
  }

  if (criterion.graphProbe === "graphDomainNodesFromDownstream") {
    const types = ["useCase", "feature", "actor", "screen", "api"];
    const count = types.reduce((n, t) => n + (inventory.nodeCounts[t] ?? 0), 0);
    const min = criterion.minGraphCount ?? 1;
    if (count >= min) {
      return { status: "met", evidence: [`graph:${count} downstream domain node(s)`], graphCount: count };
    }
    return {
      status: "missing",
      evidence: [],
      gap: `Need ≥${min} domain nodes from downstream docs in graph (found ${count})`,
      graphCount: count,
    };
  }

  if (criterion.graphProbe === "dataSourcePresent") {
    if (inventory.dataSourceFiles > 0) {
      return { status: "met", evidence: [`data-source:${inventory.dataSourceFiles} file(s)`] };
    }
    return {
      status: "partial",
      evidence: [],
      gap: "No data-source files — expand pass may rely on user clarify only",
    };
  }

  if (/definedIn|data-source|rendersTo/i.test(probe) && inventory.dataSourceFiles > 0) {
    const hints = criterion.dataSourceHints ?? [];
    if (hints.length > 0) {
      return {
        status: "partial",
        evidence: [`data-source:${inventory.dataSourceFiles} file(s)`],
        gap: `Confirm data-source covers: ${hints.join(", ")}`,
      };
    }
    return {
      status: "partial",
      evidence: [`data-source:${inventory.dataSourceFiles} file(s)`],
      gap: "Confirm relevant data-source files address this criterion",
    };
  }

  if (nodeType && (inventory.nodeCounts[nodeType] ?? 0) > 0) {
    const count = inventory.nodeCounts[nodeType]!;
    return {
      status: "met",
      evidence: [`graph:${count} ${nodeType} node(s)`],
      graphCount: count,
    };
  }

  if (inventory.analysisGaps > 0 && criterion.severity === "blocking") {
    return {
      status: "partial",
      evidence: [`analysis-gaps:${inventory.analysisGaps}`],
      gap: "Analysis gaps exist — may need analyze/index or user input",
    };
  }

  const openMatch = findContextMatch(
    criterion,
    inventory.contextEntries.filter((e) => e.status === "open"),
  );
  if (openMatch) {
    return {
      status: "partial",
      evidence: [`context-open:${openMatch.id}`],
      gap: "Question recorded but not answered yet",
      contextEntryId: openMatch.id,
    };
  }

  return {
    status: "missing",
    evidence: [],
    gap: inventory.graph
      ? "No matching graph or context evidence"
      : "Graph not loaded — run analyze/index or provide answers via context_record",
  };
}
