import type { AdoptPlan, AdoptScanResult } from "../adopt/types.js";

export interface AdoptPlanSummary {
  moveCount: number;
  layers: { srs: number; basicDesign: number; detailDesign: number; prototype: number };
  lowConfidenceCount: number;
  classification: AdoptScanResult["classification"];
  warnings: string[];
}

export function buildAdoptPlanSummary(
  plan: AdoptPlan,
  classification: AdoptScanResult["classification"],
): AdoptPlanSummary {
  const layers = { srs: 0, basicDesign: 0, detailDesign: 0, prototype: 0 };
  let lowConfidenceCount = 0;
  for (const move of plan.moves) {
    if (move.layer === "srs") layers.srs++;
    else if (move.layer === "basic-design") layers.basicDesign++;
    else if (move.layer === "detail-design") layers.detailDesign++;
    else if (move.layer === "prototype") layers.prototype++;
    if (move.confidence === "low") lowConfidenceCount++;
  }
  return {
    moveCount: plan.moves.length,
    layers,
    lowConfidenceCount,
    classification,
    warnings: plan.warnings,
  };
}
