export type NodeType =
  | "bundle"
  | "sourceFile"
  | "document"
  | "section"
  | "table"
  | "diagram"
  | "actor"
  | "useCase"
  | "feature"
  | "requirement"
  | "nfr"
  | "dataEntity";

export type BundleRole = "source" | "business" | "spec";

export type EdgeType =
  | "partOf"
  | "contains"
  | "follows"
  | "references"
  | "listedIn"
  | "definedIn"
  | "describedIn"
  | "satisfies"
  | "dependsOn"
  | "requires"
  | "tracesTo"
  | "derivedFrom"
  | "rendersTo"
  | "relatesTo"
  | "translationOf";

export interface GraphNode {
  id: string;
  type: NodeType;
  [key: string]: unknown;
}

export interface GraphEdge {
  type: EdgeType;
  from: string;
  to: string;
  role?: string;
}

export interface TraceabilityGraph {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RegistrySection {
  id: string;
  heading: string;
  level: number;
  order?: number;
}

export interface RegistryDocument {
  documentId: string;
  template: string;
  output?: string;
  outputPattern?: string;
  perDomain?: string;
  sections: RegistrySection[];
}

export interface SectionRegistry {
  version: number;
  root: string;
  documents: RegistryDocument[];
}

export interface ValidationIssue {
  ruleId: string;
  severity: "error" | "warn";
  message: string;
  nodeId?: string;
  edge?: GraphEdge;
}
