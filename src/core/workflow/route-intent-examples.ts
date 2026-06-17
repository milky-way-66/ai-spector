/**
 * Canonical WORKFLOW.md phrase → skill map. Keep in sync with `.cursor/WORKFLOW.md`
 * "What to say" table; `route-intent.test.ts` enforces parity via workflow_route.
 */
export interface WorkflowRouteExample {
  say: string;
  skill: string;
  /** When set, classifier must return askUser instead of routing directly. */
  expectAskUser?: boolean;
}

export const WORKFLOW_ROUTE_EXAMPLES: WorkflowRouteExample[] = [
  { say: "open the course", skill: "ai-spector-course" },
  { say: "learn ai-spector", skill: "ai-spector-course" },
  { say: "setup ai-spector", skill: "ai-spector-setup" },
  { say: "check my workspace", skill: "ai-spector-check" },
  { say: "stale clarifications", skill: "ai-spector-check" },
  { say: "open questions", skill: "ai-spector-check" },
  { say: "resume my SRS", skill: "ai-spector-task" },
  { say: "continue generation", skill: "ai-spector-task" },
  { say: "pause task", skill: "ai-spector-task" },
  { say: "analyze my data source", skill: "ai-spector-graph" },
  { say: "validate the graph", skill: "ai-spector-graph" },
  { say: "re-index", skill: "ai-spector-graph" },
  { say: "sync the graph", skill: "ai-spector-graph" },
  { say: "show the graph", skill: "ai-spector-graph" },
  { say: "what's impacted", skill: "ai-spector-graph" },
  { say: "generate SRS", skill: "ai-spector-generate-srs" },
  { say: "write use cases", skill: "ai-spector-generate-srs" },
  { say: "wireframes", skill: "ai-spector-generate-basic-design" },
  { say: "generate detail design", skill: "ai-spector-generate-detail-design" },
  { say: "I want to generate detail design", skill: "ai-spector-generate-detail-design" },
  { say: "we need to generate detail design", skill: "ai-spector-generate-detail-design" },
  { say: "feature-level design", skill: "ai-spector-generate-detail-design" },
  { say: "detail design for checkout", skill: "ai-spector-generate-detail-design" },
  { say: "pending specs", skill: "ai-spector-generate" },
  { say: "prototype with stripe theme", skill: "ai-spector-generate-prototype" },
  { say: "show me themes", skill: "ai-spector-generate-prototype" },
  { say: "find all mentions of rate limiting", skill: "ai-spector-search" },
  { say: "which docs describe login?", skill: "ai-spector-search" },
  { say: "pending translations", skill: "ai-spector-lang-status" },
  { say: "what's stale in JP", skill: "ai-spector-lang-status" },
  { say: "resolve translations", skill: "ai-spector-resolve-translation" },
  { say: "resolve comments", skill: "ai-spector-resolve-comments" },
  { say: "resolve all comments on login screen", skill: "ai-spector-resolve-prototype-comments" },
  { say: "batch prototype comments B-001", skill: "ai-spector-resolve-prototype-comments" },
  { say: "review docs", skill: "ai-spector-review" },
  { say: "approve SRS", skill: "ai-spector-review" },
  { say: "approve detail-design/feature-list", skill: "ai-spector-review" },
  { say: "import template", skill: "ai-spector-template-import" },
  { say: "help me approve", skill: "ai-spector", expectAskUser: true },
];
