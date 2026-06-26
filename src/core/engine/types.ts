export interface EngineArtifacts {
  graph: string;
  registry: string;
  impactRules: string;
  tasks: string;
  context: string;
  knowledge: string;
  extracted: string;
}

export interface EngineReadinessConfig {
  profile?: string;
  standards?: string[];
  docTypes?: Record<string, { profile?: string; enabled?: boolean }>;
  lastScan?: { profile: string; docType: string; scannedAt: string } | null;
}

export interface EngineConfig {
  schemaVersion: 1;
  scaffoldVersion?: string;
  artifacts: EngineArtifacts;
  cocoindex?: { enabled?: boolean };
  readiness: EngineReadinessConfig;
}
