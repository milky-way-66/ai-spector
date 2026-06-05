import type { LayerAuditReport } from "./layer-audit.js";
import type { InMemoryGraph } from "./InMemoryGraph.js";
import type { ValidationIssue } from "./types.js";

export interface GraphHealthSummary {
  structureErrors: number;
  structureWarnings: number;
  layerOk: boolean;
  layersNeedingWork: string[];
  suggestedCommand?: string;
  suggestedAgentCommand?: string;
}

export function summarizeValidation(issues: ValidationIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const i of issues) {
    if (i.severity === "error") {
      errors++;
    } else {
      warnings++;
    }
  }
  return { errors, warnings };
}

export function layersNeedingWork(report: LayerAuditReport): string[] {
  const L = report.layers;
  const out: string[] = [];
  if (!L.structure.ok) out.push("structure");
  if (!L.specInstances.ok) out.push("specInstances");
  if (!L.domain.ok) out.push("domain");
  if (!L.sourceHub.ok) out.push("sourceHub");
  if (!L.businessHub.ok) out.push("businessHub");
  if (!L.provenance.ok) out.push("provenance");
  if (!L.semanticLinks.ok) out.push("semanticLinks");
  return out;
}

export function graphHealthSummary(
  graph: InMemoryGraph,
  layerReport: LayerAuditReport,
): GraphHealthSummary {
  const validation = summarizeValidation(graph.validateStructure());
  const needing = layersNeedingWork(layerReport);
  return {
    structureErrors: validation.errors,
    structureWarnings: validation.warnings,
    layerOk: needing.length === 0,
    layersNeedingWork: needing,
    suggestedCommand: layerReport.suggestedCommand,
    suggestedAgentCommand: layerReport.suggestedAgentCommand,
  };
}
