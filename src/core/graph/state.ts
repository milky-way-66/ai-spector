export interface ProjectAnalysisState {
  graphPreparedAt?: string;
  graphMergedAt?: string;
  indexRefreshedAt?: string;
  lastMergeSource?: string;
}

export interface ProjectIndexState {
  lastRunAt?: string;
  sourceHashes?: Record<string, string>;
}

export interface ProjectState {
  version?: number;
  analysis?: ProjectAnalysisState;
  index?: ProjectIndexState;
}

export function parseProjectState(json: unknown): ProjectState {
  if (!json || typeof json !== "object") {
    return { version: 1 };
  }
  const raw = json as ProjectState;
  return {
    version: raw.version ?? 1,
    analysis: raw.analysis,
    index: raw.index,
  };
}

/** ISO timestamp of last index run, if present. */
export function lastIndexRunAt(state: ProjectState): string | undefined {
  return state.index?.lastRunAt;
}

/** ISO timestamp of last graph merge, if present. */
export function lastGraphMergedAt(state: ProjectState): string | undefined {
  return state.analysis?.graphMergedAt;
}
