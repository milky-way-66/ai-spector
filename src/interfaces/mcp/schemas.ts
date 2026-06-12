import { z } from "zod";

// ── Shared ────────────────────────────────────────────────────────────────────

export const RootSchema = z.object({
  root: z.string().optional().describe("Project root directory (auto-detected if omitted)"),
});

// ── Graph ─────────────────────────────────────────────────────────────────────

export const GraphQuerySchema = RootSchema.extend({
  seedId: z.string().describe("Node id to start the traversal from"),
  direction: z
    .enum(["out", "in", "both"])
    .optional()
    .describe("Edge traversal direction (default: out)"),
  depth: z.number().int().min(1).optional().describe("Max traversal depth (default: 3)"),
  edges: z
    .string()
    .optional()
    .describe("Comma-separated edge types to include (e.g. 'contains,implements')"),
});

export const GraphImpactSchema = RootSchema.extend({
  change: z.string().describe("Description of the change being made"),
  originId: z.string().optional().describe("Graph node id of the changed element"),
  file: z.string().optional().describe("File path of the changed element"),
  heading: z.string().optional().describe("Section heading within the file"),
  git: z.boolean().optional().describe("Derive origin from staged git diff"),
  output: z.string().optional().describe("Write impact report JSON to this path"),
});

export const GraphValidateSchema = RootSchema;

export const GraphMergeSchema = RootSchema.extend({
  fromKnowledge: z
    .boolean()
    .optional()
    .describe("Merge from knowledge.json (AI analysis output)"),
});

export const GraphReportSchema = RootSchema.extend({
  format: z
    .enum(["text", "json", "markdown"])
    .optional()
    .describe("Output format (default: text)"),
});

// ── Index ─────────────────────────────────────────────────────────────────────

export const IndexSchema = RootSchema.extend({
  graphOnly: z.boolean().optional().describe("Only rebuild graph, skip doc indexes"),
  docsOnly: z.boolean().optional().describe("Only rebuild doc indexes, skip graph"),
  skipMerge: z.boolean().optional().describe("Skip knowledge.json merge step"),
  skipValidate: z.boolean().optional().describe("Skip graph validation step"),
  skipDocSemantics: z.boolean().optional().describe("Skip SRS body extraction step"),
  cocoindexSync: z
    .boolean()
    .optional()
    .describe("Run CocoIndex pipeline update after indexing (requires Python + CocoIndex configured)"),
});

// ── Comments ──────────────────────────────────────────────────────────────────

export const CommentsListSchema = RootSchema.extend({
  filePath: z.string().optional().describe("Filter by file path"),
  status: z
    .enum(["open", "resolved", "all"])
    .optional()
    .describe("Filter by status (default: open)"),
});

export const CommentsInboxSchema = RootSchema.extend({
  filePath: z.string().optional().describe("Filter by file path"),
  status: z
    .enum(["open", "resolved", "all"])
    .optional()
    .describe("Filter by status (default: open)"),
});

export const CommentsShowSchema = RootSchema.extend({
  threadId: z.string().describe("Comment thread id"),
  filePath: z.string().optional().describe("File path scope"),
});

export const CommentsResolveSchema = RootSchema.extend({
  threadId: z.string().describe("Comment thread id to resolve"),
  filePath: z.string().describe("File path the comment is anchored to"),
  resolvedBy: z.string().optional().describe("Who resolved it (name or agent id)"),
  dryRun: z.boolean().optional().describe("Preview resolution without writing"),
});

// ── CocoIndex ─────────────────────────────────────────────────────────────────

export const DocsSearchSchema = RootSchema.extend({
  query: z.string().describe("Natural language search query over project docs"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Max results to return (default: 5)"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum cosine similarity 0–1 (default: 0.35)"),
});

export const CocoindexStatusSchema = RootSchema;

export const CocoindexStatsSchema = RootSchema;

export const CocoindexIndexSchema = RootSchema;

export const GraphQueryFuzzySchema = RootSchema.extend({
  query: z.string().describe("Natural language description of the graph node to find"),
  direction: z
    .enum(["out", "in", "both"])
    .optional()
    .describe("Edge traversal direction once node is resolved (default: out)"),
  depth: z.number().int().min(1).optional().describe("Max traversal depth (default: 3)"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum cosine similarity for node resolution (default: 0.35)"),
});

// ── Knowledge ─────────────────────────────────────────────────────────────────

export const KnowledgeStatusSchema = RootSchema;

export const KnowledgeValidateSchema = RootSchema;

export const KnowledgeSchemaSchema = RootSchema;

// ── Lang queue ────────────────────────────────────────────────────────────────

export const LangQueueSchema = RootSchema.extend({
  lang: z.string().optional().describe("Filter by language code (e.g. 'jp', 'vi')"),
  limit: z.number().int().min(1).optional().describe("Max pending jobs to return (default: all)"),
  status: z
    .enum(["pending", "failed", "resolved", "all"])
    .optional()
    .describe("Which queue to read (default: pending)"),
});

// ── Resolve Task ─────────────────────────────────────────────────────────────

export const TaskDomainEnum = z.enum([
  "docs",
  "prototype",
  "graph",
  "template",
  "lang",
  "index",
  "comments",
  "other",
]);

export const GoalSpecSchema = z.object({
  trigger: z.string().describe("Original user intent verbatim"),
  domain: TaskDomainEnum.describe("Affected domain"),
  scope: z.array(z.string()).describe("File paths or node IDs expected to change"),
  criteria: z.array(z.string()).describe("Acceptance criteria — what done looks like"),
  notes: z.string().optional().describe("Extra context from clarification"),
});

export const TaskStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  tool: z.string().describe("Which run* function or MCP tool handles this step"),
  args: z.record(z.string(), z.unknown()),
});

export const TaskPlanSchema = z.object({
  goal: GoalSpecSchema,
  steps: z.array(TaskStepSchema),
});

export const FullTaskPlanSchema = TaskPlanSchema.extend({
  id: z.string(),
  impactMap: z.array(
    z.object({
      nodeId: z.string(),
      directCallers: z.number(),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
    }),
  ),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  approvedAt: z.string().optional(),
});

export const ResolveTaskSchema = RootSchema.extend({
  taskId: z
    .string()
    .optional()
    .describe(
      "Load approved GoalSpec + TaskPlan from .ai-spector/.docflow/tasks/<id>.json instead of inline plan",
    ),
  intent: z.string().optional().describe("Free-form user intent (required when taskId omitted)"),
  goalSpec: GoalSpecSchema.optional().describe("Required when taskId omitted"),
  plan: TaskPlanSchema.optional().describe("Required when taskId omitted"),
  dryRun: z.boolean().optional().describe("Validate and plan without writing any changes"),
});

// ── Reviews ───────────────────────────────────────────────────────────────────

export const ReviewApproveSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  by: z.string().optional().describe("Reviewer name or id (default: local)"),
});

export const ReviewStatusSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path"),
  showDiff: z.boolean().optional().describe("Include diff content in result (default: true)"),
  includeHistory: z.boolean().optional().describe("Include approval history events (default: false)"),
  historyLimit: z.number().int().min(0).optional().describe("Max history entries to return"),
  historySince: z.string().optional().describe("Only return history entries after this ISO timestamp"),
});

export const ReviewQueueSchema = RootSchema.extend({
  track: z
    .enum(["internal", "client", "all"])
    .optional()
    .describe("Which queue to show (default: all)"),
  showDiff: z.boolean().optional().describe("Include diff content for pending entries (default: true)"),
});

export const ReviewCheckSchema = RootSchema;

export const ReviewMigrateSchema = RootSchema;

// ── Context store ───────────────────────────────────────────────────────────

const ContextStatusEnum = z.enum(["open", "answered", "stale"]);
const ContextSourceEnum = z.enum(["user", "inferred", "data-source"]);

export const ContextListSchema = RootSchema.extend({
  docType: z.string().optional().describe("Doc type store to list (e.g. 'srs'); omit for all"),
  status: ContextStatusEnum.optional().describe("Filter by entry status"),
});

export const ContextRecordSchema = RootSchema.extend({
  docType: z.string().describe("Doc type this clarification informs (e.g. 'srs')"),
  question: z.string().describe("The clarifying question"),
  answer: z.string().optional().describe("Answer, when recording an already-answered clarification"),
  scope: z.string().optional().describe("DAG node / section this informs (e.g. 'srs.use-cases')"),
  source: ContextSourceEnum.optional().describe("Origin of the entry (default: user)"),
  sourceRefs: z
    .array(z.string())
    .optional()
    .describe("Files whose change makes this entry stale (relative to root)"),
  answeredBy: z.string().optional().describe("Who answered"),
});

export const ContextResolveSchema = RootSchema.extend({
  docType: z.string().describe("Doc type store containing the entry"),
  id: z.string().describe("Entry id, e.g. 'Q-001'"),
  answer: z.string().describe("The user's answer"),
  answeredBy: z.string().optional().describe("Who answered"),
});

// ── Extracted-spec review queue ─────────────────────────────────────────────

const SpecStatusEnum = z.enum(["pending", "approved", "rejected"]);

const SpecPatchSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(z.record(z.string(), z.unknown())),
    edges: z.array(z.record(z.string(), z.unknown())),
  })
  .describe("Graph patch (ExtractPatch) merged on approval");

export const SpecListSchema = RootSchema.extend({
  docType: z.string().optional().describe("Doc type queue to list (e.g. 'srs'); omit for all"),
  status: SpecStatusEnum.optional().describe("Filter by spec status"),
});

export const SpecRecordSchema = RootSchema.extend({
  docType: z.string().describe("Doc type the specs were extracted from (e.g. 'srs')"),
  specs: z
    .array(
      z.object({
        statement: z.string().describe("Short statement of the extracted spec"),
        extractedFrom: z
          .array(z.string())
          .describe("Generated document(s) the spec came from (relative paths)"),
        patch: SpecPatchSchema.optional(),
      }),
    )
    .min(1)
    .describe("Specs to queue as pending"),
});

export const SpecApproveSchema = RootSchema.extend({
  docType: z.string().describe("Doc type queue containing the spec"),
  id: z.string().describe("Spec id, e.g. 'SPEC-001'"),
  by: z.string().optional().describe("Reviewer name"),
  note: z.string().optional().describe("Review note"),
  skipMerge: z.boolean().optional().describe("Approve without merging the graph patch"),
});

export const SpecRejectSchema = RootSchema.extend({
  docType: z.string().describe("Doc type queue containing the spec"),
  id: z.string().describe("Spec id, e.g. 'SPEC-001'"),
  by: z.string().optional().describe("Reviewer name"),
  note: z.string().optional().describe("Why the spec was rejected"),
});

// ── Workspace check ─────────────────────────────────────────────────────────

export const WorkspaceCheckSchema = RootSchema.extend({
  fix: z
    .boolean()
    .optional()
    .describe("Attempt to repair auto-fixable findings (create missing dirs)"),
  paths: z
    .array(z.string())
    .optional()
    .describe(
      "Validate specific doc output paths after writing (e.g. ['docs/srs/en/3-use-cases.md'])",
    ),
});

export const ReviewRejectSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path to dismiss from internal queue"),
  reason: z.string().optional().describe("Why the change does not require re-approval"),
});

export const ReviewListSchema = RootSchema.extend({
  status: z
    .enum(["pending_internal", "pending_client", "approved", "rejected", "all"])
    .optional()
    .describe("Filter by approval status (default: all)"),
  prefix: z
    .string()
    .optional()
    .describe("Filter to documents whose logical path starts with this prefix (e.g. 'srs', 'bd')"),
});

// ── Task state (workflow persistence) ─────────────────────────────────────────

export const TaskKindEnum = z.enum(["generate", "resolve"]);
export const BuiltinWorkflowIdEnum = z.enum(["generate-srs", "generate-basic-design", "resolve"]);
/** Custom template packs use `generate-<pack-name>` (same gated steps as generate-srs). */
export const WorkflowIdEnum = z.union([
  BuiltinWorkflowIdEnum,
  z.string().regex(/^generate-[a-z0-9][a-z0-9-]*$/, "Custom pack workflow: generate-<pack-name>"),
]);
export const TaskStatusEnum = z.enum([
  "draft",
  "active",
  "paused",
  "blocked",
  "complete",
  "abandoned",
]);
export const TaskStepStatusEnum = z.enum([
  "pending",
  "in-progress",
  "done",
  "blocked",
  "skipped",
]);
export const PhaseStatusEnum = z.enum(["in_progress", "awaiting_user", "done"]);

export const GeneratePlanRowSchema = z.object({
  output: z.string(),
  dagNode: z.string(),
  sources: z.array(z.string()),
  keyPoints: z.array(z.string()),
  criteriaIds: z
    .array(z.string())
    .optional()
    .describe("Readiness criterion ids this output covers, e.g. §1-001, G-003"),
  isoRefs: z
    .array(z.string())
    .optional()
    .describe("ISO/IEC/IEEE 29148 section refs for this output, e.g. 9.6.2"),
});

export const GeneratePlanBriefingSchema = z.object({
  target: z.string(),
  graphContext: z.string().optional(),
  dataSourceFiles: z.array(z.string()).optional(),
  contextAnswers: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  template: z.string().optional(),
  excluded: z.string().optional(),
});

export const GeneratePlanSchema = z.object({
  docType: z.string(),
  language: z.string().optional(),
  scope: z.enum(["all", "explicit", "described"]),
  scopeDetail: z.string().optional(),
  briefing: z.array(GeneratePlanBriefingSchema),
  rows: z.array(GeneratePlanRowSchema),
  waves: z
    .array(z.object({ wave: z.number().int(), nodeIds: z.array(z.string()) }))
    .optional(),
});

export const StoredPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resolve"), plan: FullTaskPlanSchema }),
  z.object({ kind: z.literal("generate"), plan: GeneratePlanSchema }),
]);

export const TaskStepPatchSchema = z.object({
  status: TaskStepStatusEnum.optional(),
  completedAt: z.string().optional(),
  blocker: z.string().nullable().optional(),
  artifacts: z.array(z.string()).optional(),
  openContextIds: z.array(z.string()).optional(),
});

export const TaskUpdatePatchSchema = z.object({
  status: TaskStatusEnum.optional(),
  phase: z.string().optional(),
  phaseStatus: PhaseStatusEnum.optional(),
  currentStepId: z.string().optional(),
  nextAction: z.string().optional(),
  goal: GoalSpecSchema.nullable().optional(),
  plan: StoredPlanSchema.nullable().optional(),
  blockers: z.array(z.string()).optional(),
  contextRefs: z
    .object({
      docType: z.string().optional(),
      contextFile: z.string().optional(),
      planLog: z.string().nullable().optional(),
      extractedFile: z.string().optional(),
    })
    .optional(),
  snapshot: z
    .object({
      workspaceCheckAt: z.string().optional(),
      artifactHashes: z.record(z.string(), z.string()).optional(),
      graphMergedAt: z.string().optional(),
      readinessReportShown: z
        .boolean()
        .optional()
        .describe("Required before clarify step can be marked done on generate tasks"),
      extractOffered: z
        .boolean()
        .optional()
        .describe("Set after offering spec_record — required before task_complete"),
    })
    .optional(),
  step: z.object({ id: z.string(), patch: TaskStepPatchSchema }).optional(),
});

export const TaskCreateSchema = RootSchema.extend({
  kind: TaskKindEnum.describe("generate (SRS/basic-design) or resolve (incremental change)"),
  workflow: WorkflowIdEnum.describe("Workflow template to initialize steps from"),
  trigger: z.string().describe("Original user intent that started this task"),
  docType: z.string().optional().describe("Doc type for generate workflows (e.g. srs)"),
  force: z
    .boolean()
    .optional()
    .describe("Replace existing active task in the same slot (abandons the previous task)"),
});

const TaskListBootstrapSchema = z.object({
  kind: TaskKindEnum.describe("generate or resolve"),
  workflow: WorkflowIdEnum.describe("Workflow template for the new task"),
  trigger: z.string().describe("User intent that started this workflow"),
  docType: z.string().optional().describe("Doc type for generate workflows (e.g. srs)"),
  force: z
    .boolean()
    .optional()
    .describe("Replace existing active task in the slot (abandons the previous task)"),
});

export const TaskListSchema = RootSchema.extend({
  status: z
    .union([TaskStatusEnum, z.array(TaskStatusEnum)])
    .optional()
    .describe("Filter by task status"),
  kind: TaskKindEnum.optional(),
  workflow: WorkflowIdEnum.optional(),
  recentOnly: z.boolean().optional().describe("List only tasks in index.recent"),
  bootstrap: TaskListBootstrapSchema.optional().describe(
    "Single-call session start: create a task when the workflow slot is empty, or return activeForSlot when a resumable task already exists",
  ),
});

export const TaskStatusSchema = RootSchema;

export const TaskGetSchema = RootSchema.extend({
  taskId: z.string().describe("Task id, e.g. task-m1abc2"),
});

export const TaskUpdateSchema = RootSchema.extend({
  taskId: z.string(),
  patch: TaskUpdatePatchSchema,
});

export const TaskApprovePlanSchema = RootSchema.extend({
  taskId: z.string(),
  plan: StoredPlanSchema.optional().describe("Plan to approve; omit if already set via task_update"),
});

export const TaskResumeSchema = RootSchema.extend({
  taskId: z.string(),
});

export const TaskPauseSchema = RootSchema.extend({
  taskId: z.string(),
});

export const TaskCompleteSchema = RootSchema.extend({
  taskId: z.string(),
  summary: z.string().optional(),
});

export const TaskAbandonSchema = RootSchema.extend({
  taskId: z.string(),
  reason: z.string().optional(),
});

export const TaskRecordWaveSchema = RootSchema.extend({
  taskId: z.string(),
  waveId: z.string().describe("Wave step id, e.g. wave-1"),
  status: TaskStepStatusEnum.describe("done | in-progress | blocked"),
  artifacts: z.array(z.string()).optional().describe("Doc paths written this wave"),
  blocker: z.string().nullable().optional(),
});

// ── Template ──────────────────────────────────────────────────────────────────

export const TemplateListSchema = RootSchema;

export const TemplateInspectSchema = RootSchema.extend({
  pack: z.string().describe("Pack name to inspect"),
});

export const TemplateValidateSchema = RootSchema.extend({
  pack: z
    .string()
    .optional()
    .describe('Pack name, or "active" for the active SRS pack (default: active)'),
  sync: z
    .boolean()
    .optional()
    .describe("Update pack-setup.json from auto-detected completion"),
});

export const TemplateSetupMarkSchema = RootSchema.extend({
  pack: z.string().describe("Installed pack name"),
  itemId: z
    .string()
    .describe('pack-setup.json item id, e.g. "readiness.reviewed"'),
});

// ── Readiness assessment ──────────────────────────────────────────────────────

export const ReadinessProfilesListSchema = RootSchema;

export const ReadinessConfigSchema = RootSchema;

export const ReadinessScanSchema = RootSchema.extend({
  docType: z
    .string()
    .optional()
    .describe("Document type to scan (default: srs)"),
  profile: z
    .string()
    .optional()
    .describe("Override profile for this scan; default from docflow.config.json readiness"),
  paths: z
    .array(z.string())
    .optional()
    .describe("Specific document paths; default scans all docs for docType"),
  updateLastScan: z
    .boolean()
    .optional()
    .describe("Set readiness.lastScan in docflow.config.json after scan (recommended after profile change)"),
});

export const ReadinessCriteriaSchema = RootSchema.extend({
  docType: z
    .string()
    .optional()
    .describe('Document type: srs (default), arc42, or custom pack docType'),
  profile: z
    .string()
    .optional()
    .describe("Tailoring profile override: general, regulated, arc42"),
});

export const ReadinessAssessSchema = RootSchema.extend({
  docType: z
    .string()
    .optional()
    .describe('Document type: srs (default), arc42, or custom pack docType'),
  profile: z
    .string()
    .optional()
    .describe("Tailoring profile: general (default), regulated, arc42 — or docflow.config.json readiness.profile"),
  targets: z
    .array(z.string())
    .optional()
    .describe('DAG nodes in scope, e.g. ["srs.3-use-cases", "srs.4-system-features"]'),
  targetAll: z
    .boolean()
    .optional()
    .describe("Assess all targets in criteria file (default true when targets omitted)"),
});

export const ReadinessOutputChecklistSchema = RootSchema.extend({
  docType: z
    .string()
    .optional()
    .describe("Document type (default: srs)"),
  profile: z.string().optional().describe("Tailoring profile override"),
  paths: z
    .array(z.string())
    .describe("Generated doc paths just written — agent scores checklist items semantically"),
});
