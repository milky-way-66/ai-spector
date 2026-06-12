export type BuiltinWorkflowId = "generate-srs" | "generate-basic-design" | "resolve";
/** Builtin workflows or custom pack workflows (`generate-<pack-name>`). */
export type WorkflowId = BuiltinWorkflowId | `generate-${string}`;

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

export const WORKFLOW_TEMPLATES: Record<BuiltinWorkflowId, WorkflowTemplate> = {
  "generate-srs": { id: "generate-srs", kind: "generate", steps: GENERATE_STEPS },
  "generate-basic-design": {
    id: "generate-basic-design",
    kind: "generate",
    steps: GENERATE_STEPS,
  },
  resolve: { id: "resolve", kind: "resolve", steps: RESOLVE_STEPS },
};

const CUSTOM_GENERATE_RE = /^generate-[a-z0-9][a-z0-9-]*$/;

export function isCustomGenerateWorkflow(workflow: string): boolean {
  return CUSTOM_GENERATE_RE.test(workflow) && !(workflow in WORKFLOW_TEMPLATES);
}

export function getWorkflowTemplate(workflow: string): WorkflowTemplate {
  const builtin = WORKFLOW_TEMPLATES[workflow as BuiltinWorkflowId];
  if (builtin) return builtin;
  if (isCustomGenerateWorkflow(workflow)) {
    return { id: workflow as WorkflowId, kind: "generate", steps: GENERATE_STEPS };
  }
  throw new Error(`Unknown workflow "${workflow}"`);
}

export function defaultNextAction(workflow: WorkflowId, stepId: string): string {
  const step = getWorkflowTemplate(workflow).steps.find((s) => s.id === stepId);
  return step?.description ?? "Continue the workflow";
}

export function activeSlotFor(kind: TaskKind, workflow: string, docType?: string): string {
  if (kind === "resolve") return "resolve";
  if (workflow === "generate-srs") return "generate:srs";
  if (workflow === "generate-basic-design") return "generate:basic-design";
  if (docType?.trim()) return `generate:${docType.trim()}`;
  if (isCustomGenerateWorkflow(workflow)) {
    return `generate:${workflow.replace(/^generate-/, "")}`;
  }
  return `generate:${workflow}`;
}

/** Workflow id for task_create bootstrap from docType / active pack. */
export function workflowForPackDocType(docType: string, activePack?: string): string {
  if (docType === "srs" && (!activePack || activePack === "builtin")) return "generate-srs";
  if (docType === "basic-design") return "generate-basic-design";
  if (activePack && activePack !== "builtin" && docType === activePack) {
    return `generate-${activePack}`;
  }
  return `generate-${docType}`;
}

export type GenerateDocType = "srs" | "basic-design";

export const GENERATE_DOC_TYPES: GenerateDocType[] = ["srs", "basic-design"];

export function workflowForDocType(docType: GenerateDocType): WorkflowId {
  return docType === "srs" ? "generate-srs" : "generate-basic-design";
}

export function activeSlotForDocType(docType: GenerateDocType): string {
  return activeSlotFor("generate", workflowForDocType(docType));
}

/** Builtin SRS/BD chapter path under `docs/{type}/{lang}/…`. */
export function generateSlotFromDocPath(relPath: string): string | null {
  const n = relPath.replace(/\\/g, "/");
  if (/^docs\/srs\/[^/]+\/.+\.md$/i.test(n)) return "generate:srs";
  if (/^docs\/basic-design\/[^/]+\/.+\.md$/i.test(n)) return "generate:basic-design";
  return null;
}

/** Match doc path to custom pack slot using manifest output paths. */
export function generateSlotFromPackOutputs(
  relPath: string,
  packName: string,
  documents: { output?: string; outputPattern?: string }[],
): string | null {
  const n = relPath.replace(/\\/g, "/");
  for (const doc of documents) {
    if (doc.output && n === doc.output.replace(/\\/g, "/")) {
      return `generate:${packName}`;
    }
    if (doc.outputPattern) {
      const prefix = doc.outputPattern.split("{")[0]?.replace(/\\/g, "/");
      if (prefix && prefix.length > 3 && n.startsWith(prefix)) {
        return `generate:${packName}`;
      }
    }
  }
  return null;
}

export function slotToDocTypeLabel(slot: string): string | null {
  if (slot === "generate:srs") return "srs";
  if (slot === "generate:basic-design") return "basic-design";
  if (slot.startsWith("generate:")) return slot.slice("generate:".length);
  return null;
}
