export type WorkflowId = "generate-srs" | "generate-basic-design" | "resolve";

export type TaskKind = "generate" | "resolve";

export interface TemplateStep {
  id: string;
  phase: string;
  description: string;
}

export interface WorkflowTemplate {
  id: WorkflowId;
  kind: TaskKind;
  steps: TemplateStep[];
}

const GENERATE_STEPS: TemplateStep[] = [
  { id: "check", phase: "check", description: "Validate workspace structure" },
  { id: "clarify", phase: "clarify", description: "Resolve clarification gaps" },
  { id: "briefing", phase: "briefing", description: "Confirm context briefing with user" },
  { id: "plan", phase: "plan", description: "Present plan table and get approval" },
  { id: "generate-waves", phase: "generate", description: "Generate documents in DAG waves" },
  { id: "extract", phase: "extract", description: "Extract specs and offer review queue" },
];

const RESOLVE_STEPS: TemplateStep[] = [
  { id: "clarify", phase: "clarify", description: "Clarify GoalSpec fields" },
  { id: "discover", phase: "discover", description: "Read-only lookup for scope" },
  { id: "plan", phase: "plan", description: "Present GoalSpec + TaskPlan for approval" },
  { id: "execute", phase: "execute", description: "Run approved plan steps" },
  { id: "report", phase: "report", description: "Summarize state update" },
];

export const WORKFLOW_TEMPLATES: Record<WorkflowId, WorkflowTemplate> = {
  "generate-srs": { id: "generate-srs", kind: "generate", steps: GENERATE_STEPS },
  "generate-basic-design": {
    id: "generate-basic-design",
    kind: "generate",
    steps: GENERATE_STEPS,
  },
  resolve: { id: "resolve", kind: "resolve", steps: RESOLVE_STEPS },
};

export function getWorkflowTemplate(workflow: WorkflowId): WorkflowTemplate {
  const template = WORKFLOW_TEMPLATES[workflow];
  if (!template) {
    throw new Error(`Unknown workflow "${workflow}"`);
  }
  return template;
}

export function defaultNextAction(workflow: WorkflowId, stepId: string): string {
  const step = getWorkflowTemplate(workflow).steps.find((s) => s.id === stepId);
  return step?.description ?? "Continue the workflow";
}

export function activeSlotFor(kind: TaskKind, workflow: WorkflowId): string {
  if (kind === "resolve") return "resolve";
  if (workflow === "generate-srs") return "generate:srs";
  if (workflow === "generate-basic-design") return "generate:basic-design";
  return `generate:${workflow}`;
}
