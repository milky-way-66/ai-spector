export type AdoptLayerClass = "builtin-aligned" | "reshaped" | "custom" | "missing";
export type AdoptPrototypeClass = "static-html" | "spa" | "disconnected" | "missing";
export type AdoptLangStrategy = "per-lang-folders" | "flat" | "mixed";
export type AdoptMoveConfidence = "high" | "medium" | "low";
export type AdoptPlanStatus = "draft" | "approved" | "applied";

export interface AdoptQuestion {
  id: string;
  prompt: string;
  blocking: boolean;
}

export type AdoptDocLayer = "srs" | "basic-design" | "detail-design" | "prototype" | "data-source";

export interface AdoptInventoryItem {
  path: string;
  layer: AdoptDocLayer;
  signals: { headings: Array<{ depth: number; text: string }>; ids: string[] };
}

export interface AdoptScanResult {
  scannedAt: string;
  classification: {
    srs: AdoptLayerClass;
    basicDesign: AdoptLayerClass;
    detailDesign: AdoptLayerClass;
    prototype: AdoptPrototypeClass;
    languages: { detected: string[]; strategy: AdoptLangStrategy };
    dataSource: "present" | "partial" | "absent";
    activePack: string;
  };
  inventory: AdoptInventoryItem[];
  questionsForUser: AdoptQuestion[];
}

export interface AdoptMove {
  from: string;
  to: string;
  layer: "srs" | "basic-design" | "detail-design" | "prototype";
  documentId?: string;
  confidence: AdoptMoveConfidence;
  reason: string;
}

export interface AdoptPlan {
  version: 1;
  status: AdoptPlanStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  moves: AdoptMove[];
  configPatches: Array<{ path: string; set: Record<string, unknown> }>;
  prototypeActions: Array<{ action: string; from?: string; to?: string; after?: string }>;
  warnings: string[];
  blockingIssues: string[];
}

export interface AdoptSetupItem {
  done: boolean;
  at: string | null;
}

export interface AdoptSetupState {
  version: 1;
  items: Record<string, AdoptSetupItem>;
}
