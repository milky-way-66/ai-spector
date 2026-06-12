export type ReadinessSeverity = "blocking" | "should-ask" | "nice-to-have";
export type ReadinessStatus = "met" | "partial" | "missing" | "stale";

export interface ReadinessCriterion {
  id: string;
  dimension?: string;
  severity: ReadinessSeverity;
  iso29148?: string;
  field?: string;
  question: string;
  graphProbe?: string;
  dataSourceHints?: string[];
  acceptAssumption?: boolean;
  perEntity?: string;
  minGraphCount?: number;
  placeholder?: string;
  heading?: string;
  webSearchWhen?: string;
}

export interface ReadinessTarget {
  dagNode: string;
  outputPattern?: string;
  documentId?: string;
  template?: string;
  perDomain?: string;
  iso29148?: string[];
  criteria: ReadinessCriterion[];
}

export interface ReadinessCriteriaFile {
  version?: number;
  docType?: string;
  packName?: string;
  purpose?: string;
  standards?: unknown[];
  dimensions?: unknown[];
  /** Template filename → ISO/IEC/IEEE 29148 §9.6 section refs (builtin SRS). */
  templateToIso29148?: Record<string, string[]>;
  globalCriteria: ReadinessCriterion[];
  targets: ReadinessTarget[];
  requirementQuality?: unknown;
  appliedProfiles?: string[];
}

export interface TailoringProfile {
  id: string;
  title: string;
  description?: string;
  extends?: string;
  replaceBase?: boolean;
  docType?: string;
  bumpSeverity?: Record<string, ReadinessSeverity>;
  disableAssumptions?: string[];
  addGlobalCriteria?: ReadinessCriterion[];
  addTargetCriteria?: Array<{
    dagNode: string;
    criteria: ReadinessCriterion[];
  }>;
  /** When replaceBase — full criteria document */
  version?: number;
  standards?: unknown[];
  dimensions?: unknown[];
  globalCriteria?: ReadinessCriterion[];
  targets?: ReadinessTarget[];
  requirementQuality?: unknown;
}

export interface ReadinessCriterionResult {
  id: string;
  scope: "global" | string;
  dimension?: string;
  severity: ReadinessSeverity;
  status: ReadinessStatus;
  question: string;
  iso29148?: string;
  field?: string;
  evidence: string[];
  gap?: string;
  graphCount?: number;
  contextEntryId?: string;
  acceptAssumption?: boolean;
}

export interface ReadinessAssessSummary {
  total: number;
  met: number;
  partial: number;
  missing: number;
  stale: number;
  blockingTotal: number;
  blockingMet: number;
  blockingMissing: number;
  shouldAskMissing: number;
}

export interface ReadinessInventory {
  graphLoaded: boolean;
  nodeCounts: Record<string, number>;
  totalNodes: number;
  contextOpen: number;
  contextAnswered: number;
  contextStale: number;
  dataSourceFiles: number;
  analysisGaps: number;
}

export interface StandardsAlignment {
  configDeclared: string[];
  criteriaFile: string[];
  unmatchedInCriteria: string[];
  note: string;
}

export interface ReadinessAssessResult {
  ready: boolean;
  docType: string;
  packName: string | null;
  profile: string;
  appliedProfiles: string[];
  criteriaPath: string;
  /** How docflow.config readiness.standards relates to criteria file standards[]. */
  standardsAlignment?: StandardsAlignment;
  scope: { dagNodes: string[]; targetAll: boolean };
  summary: ReadinessAssessSummary;
  requirementQuality?: {
    note?: string;
    addressableFromGraph?: number;
    totalCharacteristics?: number;
    gaps?: string[];
  };
  criteria: ReadinessCriterionResult[];
  blockingGaps: ReadinessCriterionResult[];
  questionsForUser: string[];
  inventory: ReadinessInventory;
}
