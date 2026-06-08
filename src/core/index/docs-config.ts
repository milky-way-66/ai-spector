export interface IndexDocsConfig {
  version?: number;
  outputs: {
    srs: string;
    basicDesign: string;
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

export function indexDocsConfigPath(projectRoot: string): string {
  return `${projectRoot}/.ai-spector/.docflow/config/index.docs.json`;
}
