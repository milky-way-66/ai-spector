export const ENGINE_CONFIG_REL = ".ai-spector/engine.json";

export const DEFAULT_ENGINE_ARTIFACTS = {
  graph: ".ai-spector/graph/traceability.graph.json",
  registry: ".ai-spector/registry/section-registry.json",
  impactRules: ".ai-spector/rules/impact.json",
  tasks: ".ai-spector/.docflow/tasks",
  context: ".ai-spector/.docflow/context",
  knowledge: ".ai-spector/.docflow/knowledge",
  extracted: ".ai-spector/.docflow/extracted",
} as const;
