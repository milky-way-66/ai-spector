import type { ImpactEntry } from "../graph/impact.js";

export interface DocAnchor {
  path: string;
  hash: string;
  gitRef: string | null;
  anchoredAt: string;
}

export type DiffSource = "git" | "legacy_snapshot" | "legacy_content" | "none";

export interface ImpactBuckets {
  intraDocTargets?: string[];
  regenerate: ImpactEntry[];
  syncUpstream: ImpactEntry[];
  review: ImpactEntry[];
}

export interface LayerDriftSummary {
  baselineLabel?: string;
  baselineCreatedAt: string;
  modified: string[];
}

export interface EnrichmentCache {
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  diffSource: DiffSource;
  impact: ImpactBuckets;
  layerDrift?: LayerDriftSummary;
  computedAt: string;
  anchorHash: string;
}
