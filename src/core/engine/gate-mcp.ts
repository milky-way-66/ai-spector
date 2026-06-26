import type { DocopsCapabilities } from "../docops/paths.js";
import type { DocopsConfig } from "../docops/types.js";
import { isCapabilityEnabled } from "./gate.js";

const TOOL_CAPABILITY: Record<string, keyof DocopsCapabilities | null> = {
  docops_status: null,
  workspace_check: null,
  workflow_route: null,
  graph_query: "graph",
  graph_impact: "graph",
  graph_validate: "graph",
  graph_merge: "graph",
  graph_report: "graph",
  graph_query_fuzzy: "graph",
  index: "graph",
  docs_search: "graph",
  contract_review: "review",
  contract_comments: "comments",
  contract_prototype: "prototype",
  contract_translate: "translate",
  context_list: "generate",
  context_record: "generate",
  context_resolve: "generate",
  spec_list: "generate",
  spec_record: "generate",
  spec_approve: "generate",
  spec_reject: "generate",
  template_list: "generate",
  template_inspect: "generate",
  work_create: null,
  work_list: null,
  work_get: null,
  work_update: null,
  work_approve_plan: null,
  work_record_step: null,
  work_pause: null,
  work_resume: null,
  work_complete: null,
  work_abandon: null,
};

export function gateMcpTool(
  tool: string,
  config: DocopsConfig,
): { allowed: boolean; reason?: string } {
  const cap = TOOL_CAPABILITY[tool];
  if (cap === undefined) return { allowed: true };
  if (cap === null) return { allowed: true };
  if (!isCapabilityEnabled(config, cap)) {
    return { allowed: false, reason: `Capability "${cap}" is disabled in docops.config.json` };
  }
  return { allowed: true };
}
