export interface IndexDocsConfig {
  version?: number;
  outputs: {
    srs: string;
    basicDesign: string;
    dataSource?: string;
  };
  sources: Record<
    string,
    {
      root: string;
      glob?: string;
      dag?: string;
    }
  >;
  entryFormat?: {
    heading?: string;
    fields?: string[];
  };
}

export const INDEX_PLACEHOLDER_MARKERS = ["not yet run", "No entries yet"] as const;

import { workspaceIndexDocsPath } from "../config/docflow-paths.js";

export function indexDocsConfigPath(projectRoot: string): string {
  return workspaceIndexDocsPath(projectRoot);
}
