import type { ImportAspectCoverage, ImportSupplementalQuestion } from "../template/import-aspects.js";

export type { ImportAspectCoverage, ImportSupplementalQuestion } from "../template/import-aspects.js";

export interface ImportManifestRow {
  file: string;
  documentId: string;
  output: string;
  type: "single" | string;
}

export interface ImportPlan {
  packName: string;
  sourceDir: string;
  documentCount: number;
  rows: ImportManifestRow[];
  waves: { wave: number; documentIds: string[] }[];
  clarifyAnswers: Record<string, string>;
  aspectCoverage?: ImportAspectCoverage[];
  /** Extra scan-driven or agent-added questions — not limited to the 10 core aspects. */
  supplementalQuestions?: ImportSupplementalQuestion[];
}

export function buildImportPlan(partial: Partial<ImportPlan> & Pick<ImportPlan, "packName" | "sourceDir">): ImportPlan {
  return {
    documentCount: partial.documentCount ?? 0,
    rows: partial.rows ?? [],
    waves: partial.waves ?? [],
    clarifyAnswers: partial.clarifyAnswers ?? {},
    aspectCoverage: partial.aspectCoverage,
    ...partial,
  };
}
