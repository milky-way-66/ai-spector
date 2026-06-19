export type DesignLayer = "srs" | "basic-design" | "detail-design";

export interface BaselineFileEntry {
  hash: string;
  sizeBytes: number;
}

export interface BaselineLayer {
  root: string;
  files: Record<string, BaselineFileEntry>;
}

export interface SyncBaseline {
  version: 1;
  createdAt: string;
  label?: string;
  gitRef: string | null;
  gitRefType: "commit" | null;
  graphHash: string;
  layers: Record<DesignLayer, BaselineLayer>;
  totals: { files: number; bytes: number };
}

export type DiffSource = "git" | "none";

export interface DriftFileEntry {
  path: string;
  baselineHash?: string;
  currentHash?: string;
  diff?: string;
  diffSource: DiffSource;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface LayerDrift {
  modified: DriftFileEntry[];
  added: DriftFileEntry[];
  deleted: DriftFileEntry[];
  unchanged: number;
}

export interface TraceabilityGaps {
  missingDownstream: Array<{ domainId: string; layer: string; message: string }>;
  missingUpstream: Array<{ domainId: string; layer: string; message: string }>;
  orphanFiles: string[];
}

export interface SyncAuditResult {
  baseline: {
    createdAt: string;
    label?: string;
    gitRef: string | null;
    totals: { files: number };
  };
  drift: {
    hasDrift: boolean;
    graphChanged: boolean;
    byLayer: Record<DesignLayer, LayerDrift>;
  };
  traceabilityGaps: TraceabilityGaps;
  impact: {
    regenerate: Array<{ id: string; projectionPath?: string; reason: string }>;
    syncUpstream: Array<{ id: string; projectionPath?: string; reason: string }>;
    review: Array<{ id: string; projectionPath?: string; reason: string }>;
    noTraceabilityImpact?: boolean;
  };
  suggestedNext: string;
  warnings?: string[];
}
