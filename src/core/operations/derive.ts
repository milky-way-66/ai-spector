import { join } from "node:path";
import { pathExists } from "../util/fs.js";

export type SourceMode = "forward" | "derive-downstream";
export type DeriveLayer = "basic-design" | "detail-design";
export type DerivePhase = "extract" | "expand";

export interface DeriveBootstrapInput {
  sourceMode?: SourceMode;
  workflow: string;
  deriveFrom?: DeriveLayer[];
  derivePhase?: DerivePhase;
  priorDeriveTaskId?: string;
}

export interface ValidatedDeriveBootstrap {
  sourceMode: SourceMode;
  deriveFrom?: DeriveLayer[];
  derivePhase: DerivePhase;
  priorDeriveTaskId?: string;
}

export const SRS_MINIMUM_PATHS = [
  "docs/srs/1-introduction.md",
  "docs/srs/4-system-features.md",
] as const;

export function validateDeriveBootstrap(
  input: DeriveBootstrapInput,
): ValidatedDeriveBootstrap {
  const sourceMode = input.sourceMode ?? "forward";
  const derivePhase = input.derivePhase ?? "extract";

  if (sourceMode === "forward") {
    return { sourceMode, derivePhase: "extract" };
  }

  if (!input.deriveFrom?.length) {
    throw new Error(
      'derive-downstream requires non-empty deriveFrom (e.g. ["basic-design","detail-design"])',
    );
  }

  if (derivePhase === "expand" && !input.priorDeriveTaskId) {
    throw new Error(
      "derivePhase expand requires priorDeriveTaskId linking a completed extract task",
    );
  }

  return {
    sourceMode,
    deriveFrom: input.deriveFrom,
    derivePhase,
    priorDeriveTaskId: input.priorDeriveTaskId,
  };
}

export async function assertDeriveNotBlockedByCompleteSrs(
  root: string,
  workflow: string,
): Promise<void> {
  if (workflow !== "generate-srs") return;
  for (const rel of SRS_MINIMUM_PATHS) {
    if (!(await pathExists(join(root, rel)))) return;
  }
  throw new Error(
    "SRS minimum outputs already exist — derive-downstream would overwrite. Use resolve-task for targeted updates.",
  );
}

export function defaultDeriveFromForWorkflow(workflow: string): DeriveLayer[] {
  if (workflow === "generate-srs") return ["basic-design", "detail-design"];
  if (workflow === "generate-basic-design") return ["detail-design"];
  return [];
}
