/** Required import aspects — minimum coverage checklist (not a maximum). */

export const IMPORT_ASPECT_IDS = [
  "doc-purpose",
  "doc-shape",
  "domain-vocabulary",
  "list-detail-pairs",
  "pack-identity",
  "output-routing",
  "standards-alignment",
  "requirements-model",
  "locale-strategy",
  "graph-seeds",
] as const;

export type ImportAspectId = (typeof IMPORT_ASPECT_IDS)[number];

export type AspectStatus = "resolved" | "inferred" | "ambiguous" | "unknown";

export type AspectConfidence = "high" | "medium" | "low";

export interface ImportAspectDefinition {
  id: ImportAspectId;
  label: string;
  neededFor: string[];
}

export const IMPORT_ASPECT_DEFINITIONS: ImportAspectDefinition[] = [
  {
    id: "doc-purpose",
    label: "Document purpose",
    neededFor: ["manifest.purpose", "manifest.docType", "readiness profile"],
  },
  {
    id: "doc-shape",
    label: "Single vs repeating files",
    neededFor: ["manifest.documents", "DAG seeds"],
  },
  {
    id: "domain-vocabulary",
    label: "Domain vocabulary (perDomain)",
    neededFor: ["manifest.perDomain", "outputPattern", "generate wave 1"],
  },
  {
    id: "list-detail-pairs",
    label: "List ↔ detail document pairs",
    neededFor: ["manifest.defaultListedIn", "generate-hints"],
  },
  {
    id: "pack-identity",
    label: "Pack name and slug",
    neededFor: ["manifest.packName", "nodePrefix", "generate skill name"],
  },
  {
    id: "output-routing",
    label: "Output paths",
    neededFor: ["manifest.output", "manifest.outputPattern", "task gate paths"],
  },
  {
    id: "standards-alignment",
    label: "Standards alignment",
    neededFor: ["manifest.standards", "readiness-criteria severity"],
  },
  {
    id: "requirements-model",
    label: "Requirements model",
    neededFor: ["extract-specs", "completeness-rules"],
  },
  {
    id: "locale-strategy",
    label: "Locale / language strategy",
    neededFor: ["docflow.config.json languages", "{lang} in outputs"],
  },
  {
    id: "graph-seeds",
    label: "Graph prerequisite node types",
    neededFor: ["pack-setup graph.prerequisites", "breakout generation"],
  },
];

/** Graph node types with first-class generate support today. */
export const BUILTIN_GRAPH_DOMAIN_TYPES = new Set([
  "useCase",
  "feature",
  "requirement",
  "nfr",
]);

export interface ImportAspectCoverage {
  aspectId: ImportAspectId;
  label: string;
  status: AspectStatus;
  neededFor: string[];
  proposal: unknown | null;
  confidence: AspectConfidence | null;
  scanEvidence: string[];
  scanSignals: string[];
  confirmedAt?: string;
  userValue?: unknown;
}

/** Scan- or agent-triggered follow-up beyond the 10 core aspects. */
export interface ImportSupplementalQuestion {
  id: string;
  scanTrigger: string;
  neededFor: string[];
  status: "open" | "resolved";
  answer?: string;
  resolvedAt?: string;
}

export function aspectDefinition(id: ImportAspectId): ImportAspectDefinition {
  const def = IMPORT_ASPECT_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown aspect "${id}"`);
  return def;
}

export function emptyAspectCoverage(id: ImportAspectId): ImportAspectCoverage {
  const def = aspectDefinition(id);
  return {
    aspectId: id,
    label: def.label,
    status: "unknown",
    neededFor: def.neededFor,
    proposal: null,
    confidence: null,
    scanEvidence: [],
    scanSignals: [],
  };
}

/** Core aspects covered — each non-resolved row has confirmedAt. */
export function isAspectCoverageComplete(coverage: ImportAspectCoverage[]): boolean {
  return coverage.every((aspect) => aspect.status === "resolved" || Boolean(aspect.confirmedAt));
}

/** Clarify done: core aspects + any supplemental scan follow-ups resolved. */
export function isImportClarifyComplete(opts: {
  aspectCoverage?: ImportAspectCoverage[];
  supplementalQuestions?: ImportSupplementalQuestion[];
}): boolean {
  if (!opts.aspectCoverage?.length) return false;
  if (!isAspectCoverageComplete(opts.aspectCoverage)) return false;
  const open = opts.supplementalQuestions?.some((q) => q.status === "open") ?? false;
  return !open;
}
