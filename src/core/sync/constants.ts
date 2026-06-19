import { join } from "node:path";
import type { DesignLayer } from "./types.js";

export const DESIGN_LAYERS: DesignLayer[] = ["srs", "basic-design", "detail-design"];

export const DESIGN_LAYER_ROOTS: Record<DesignLayer, string> = {
  srs: "docs/srs",
  "basic-design": "docs/basic-design",
  "detail-design": "docs/detail-design",
};

export function baselinePath(projectRoot: string): string {
  return join(projectRoot, ".ai-spector/.docflow/sync/baseline.json");
}
