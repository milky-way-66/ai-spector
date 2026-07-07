import { z } from "zod";

// ── Shared ────────────────────────────────────────────────────────────────────

export const RootSchema = z.object({
  root: z.string().optional().describe("Project root directory (auto-detected if omitted)"),
});

export const AuditActorRoleEnum = z.enum(["user", "client"]);

/** Optional actor overrides; generic values resolve to git user.email / user.name. */
export const AuditActorOverrideSchema = {
  by: z
    .string()
    .optional()
    .describe("Actor email override; generic values like 'user' resolve to git user.email"),
  username: z
    .string()
    .optional()
    .describe("Actor name override; generic values resolve to git user.name"),
  role: AuditActorRoleEnum.optional().describe("Actor role (default: user)"),
};

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
  direction: z
    .enum(["downstream", "upstream", "both"])
    .optional()
    .describe("Impact direction — both adds syncUpstream bucket for upstream SRS sync hints"),
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

const CommentFilterFields = {
  filePath: z
    .string()
    .optional()
    .describe("Filter by file path (use `prototype` for all prototype threads)"),
  pathPrefix: z.string().optional().describe("Logical path prefix (e.g. srs/, prototype/src/)"),
  commentTypes: z
    .array(z.enum(["document", "prototype"]))
    .optional()
    .describe("Filter by comment type"),
  screen: z.string().optional().describe("Prototype screen stem or URL fragment (e.g. login)"),
  originBranch: z.string().optional().describe("Filter by originBranch"),
  anchorState: z
    .enum(["active", "drifted", "missing"])
    .optional()
    .describe("Filter by anchor health"),
  status: z
    .enum(["open", "resolved", "all"])
    .optional()
    .describe("Filter by status (default: open)"),
  groupByScreen: z
    .boolean()
    .optional()
    .describe("Add B-00N batch rows grouped by prototype screen"),
};

export const CommentsListSchema = RootSchema.extend(CommentFilterFields);

export const CommentsInboxSchema = RootSchema.extend(CommentFilterFields);

export const CommentsFacetsSchema = RootSchema.extend({
  filePath: CommentFilterFields.filePath,
  pathPrefix: CommentFilterFields.pathPrefix,
  commentTypes: CommentFilterFields.commentTypes,
  screen: CommentFilterFields.screen,
  originBranch: CommentFilterFields.originBranch,
});

export const CommentsBatchPlanSchema = RootSchema.extend({
  ...CommentFilterFields,
  batchId: z.string().optional().describe("Batch pick id B-001"),
  picks: z.array(z.string()).optional().describe("B-00N or C-00N pick ids"),
  phrase: z.string().optional().describe("Natural phrase e.g. login screen"),
});

export const CommentsBatchResolveSchema = RootSchema.extend({
  picks: z.array(z.string()).min(1).describe("B-00N or comma-separated C-00N ids"),
  ...AuditActorOverrideSchema,
  resolvedBy: z.string().optional().describe("Deprecated alias for by"),
  dryRun: z.boolean().optional(),
});

export const CommentsShowSchema = RootSchema.extend({
  threadId: z.string().describe("Comment thread id"),
  filePath: z.string().optional().describe("File path scope"),
});

export const CommentsResolveSchema = RootSchema.extend({
  threadId: z.string().describe("Comment thread id to resolve"),
  filePath: z.string().describe("File path the comment is anchored to"),
  ...AuditActorOverrideSchema,
  resolvedBy: z
    .string()
    .optional()
    .describe("Deprecated alias for by (resolver email override)"),
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
  enrich: z
    .boolean()
    .optional()
    .describe("Compute git diff and graph impact on pending jobs (default: true)"),
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
      "Preferred: load approved GoalSpec + TaskPlan from task file (requires task_approve_plan). Tier gates must be complete first.",
    ),
  intent: z.string().optional().describe("Free-form user intent (required when taskId omitted)"),
  goalSpec: GoalSpecSchema.optional().describe("Required when taskId omitted"),
  plan: TaskPlanSchema.optional().describe("Required when taskId omitted"),
  dryRun: z.boolean().optional().describe("Validate and plan without writing any changes"),
});

// ── Reviews ───────────────────────────────────────────────────────────────────

export const ReviewDeclineSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  ...AuditActorOverrideSchema,
  note: z.string().optional().describe("Decline reason"),
});

export const ReviewCloseSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  reason: z.string().describe("Why the review is being closed without quorum"),
  ...AuditActorOverrideSchema,
});

export const ReviewApproveSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  ...AuditActorOverrideSchema,
  note: z.string().optional().describe("Review note"),
});

export const ReviewWithdrawSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  track: z.enum(["internal", "client"]).optional().describe("Review track (default: internal)"),
  ...AuditActorOverrideSchema,
});

export const ReviewReopenSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path (e.g. srs/01-overview)"),
  track: z.enum(["internal", "client"]).optional().describe("Review track (default: internal)"),
  ...AuditActorOverrideSchema,
});

export const ReviewConfigSchema = RootSchema;

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
  enrich: z
    .boolean()
    .optional()
    .describe("Compute git diff and graph impact on pending entries (default: true when showDiff)"),
});

export const ReviewCheckSchema = RootSchema;

export const ReviewBeginSchema = RootSchema.extend({
  logicalPath: z
    .string()
    .optional()
    .describe("Logical document path to start reviewing (e.g. srs/1-introduction). Omit for queue summary."),
  showDiff: z.boolean().optional().describe("Include diff when logicalPath is set (default: true)"),
  includeHistory: z.boolean().optional().describe("Include approval history when logicalPath is set"),
  historyLimit: z.number().int().positive().optional(),
  historySince: z.string().optional(),
});

export const ReviewSessionStartSchema = RootSchema;

export const ReviewSessionAckReviewSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path that was reviewed in chat"),
});

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
  ...AuditActorOverrideSchema,
  answeredBy: z
    .string()
    .optional()
    .describe("Deprecated alias for by (answerer email override)"),
});

export const ContextResolveSchema = RootSchema.extend({
  docType: z.string().describe("Doc type store containing the entry"),
  id: z.string().describe("Entry id, e.g. 'Q-001'"),
  answer: z.string().describe("The user's answer"),
  ...AuditActorOverrideSchema,
  answeredBy: z
    .string()
    .optional()
    .describe("Deprecated alias for by (answerer email override)"),
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
        provenance: z
          .enum(["forward", "derive-downstream"])
          .optional()
          .describe("derive-downstream when spec was extracted during backfill from lower layers"),
      }),
    )
    .min(1)
    .describe("Specs to queue as pending"),
});

export const SpecApproveSchema = RootSchema.extend({
  docType: z.string().describe("Doc type queue containing the spec"),
  id: z.string().describe("Spec id, e.g. 'SPEC-001'"),
  ...AuditActorOverrideSchema,
  note: z.string().optional().describe("Review note"),
  skipMerge: z.boolean().optional().describe("Approve without merging the graph patch"),
});

export const SpecRejectSchema = RootSchema.extend({
  docType: z.string().describe("Doc type queue containing the spec"),
  id: z.string().describe("Spec id, e.g. 'SPEC-001'"),
  ...AuditActorOverrideSchema,
  note: z.string().optional().describe("Why the spec was rejected"),
});

// ── Derive / task enums (shared by workspace check + task bootstrap) ─────────

export const SourceModeEnum = z.enum(["forward", "derive-downstream"]);
export const DeriveLayerEnum = z.enum(["basic-design", "detail-design"]);
export const DerivePhaseEnum = z.enum(["extract", "expand"]);

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
  workflow: z
    .string()
    .optional()
    .describe("Workflow step id for prerequisite checks (e.g. generate-srs)"),
  sourceMode: SourceModeEnum.optional().describe(
    "forward or derive-downstream when evaluating workflow prerequisites",
  ),
});

export const ReviewRejectSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path to dismiss from internal queue"),
  reason: z.string().optional().describe("Why the change does not require re-approval"),
  ...AuditActorOverrideSchema,
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

export const TaskKindEnum = z.enum(["generate", "resolve", "import", "adopt"]);

const DeriveBootstrapFields = {
  sourceMode: SourceModeEnum.optional().describe(
    "forward (default) or derive-downstream when backfilling from basic/detail design",
  ),
  deriveFrom: z
    .array(DeriveLayerEnum)
    .optional()
    .describe("Downstream layers to derive from (required when sourceMode is derive-downstream)"),
  derivePhase: DerivePhaseEnum.optional().describe(
    "extract (default) or expand after reviewing extract output",
  ),
  priorDeriveTaskId: z
    .string()
    .optional()
    .describe("Completed extract task id — required for derivePhase expand"),
};
export const BuiltinWorkflowIdEnum = z.enum([
  "generate-srs",
  "generate-basic-design",
  "generate-detail-design",
  "resolve",
  "template-import",
]);
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

export const ResolveTierEnum = z.enum(["fast", "standard", "full"]);
export const ResolveExecutionModeEnum = z.enum(["inline", "subagent"]);

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

export const ImportManifestRowSchema = z.object({
  file: z.string(),
  documentId: z.string(),
  output: z.string(),
  type: z.union([z.literal("single"), z.string()]),
});

export const ImportAspectCoverageSchema = z.object({
  aspectId: z.string(),
  label: z.string(),
  status: z.enum(["resolved", "inferred", "ambiguous", "unknown"]),
  neededFor: z.array(z.string()),
  proposal: z.unknown().nullable(),
  confidence: z.enum(["high", "medium", "low"]).nullable(),
  scanEvidence: z.array(z.string()),
  scanSignals: z.array(z.string()),
  confirmedAt: z.string().optional(),
  userValue: z.unknown().optional(),
});

export const ImportSupplementalQuestionSchema = z.object({
  id: z.string(),
  scanTrigger: z.string(),
  neededFor: z.array(z.string()),
  status: z.enum(["open", "resolved"]),
  answer: z.string().optional(),
  resolvedAt: z.string().optional(),
});

export const ImportPlanSchema = z.object({
  packName: z.string(),
  sourceDir: z.string(),
  documentCount: z.number().int(),
  rows: z.array(ImportManifestRowSchema),
  waves: z.array(z.object({ wave: z.number().int(), documentIds: z.array(z.string()) })),
  clarifyAnswers: z.record(z.string(), z.string()),
  aspectCoverage: z.array(ImportAspectCoverageSchema).optional(),
  supplementalQuestions: z.array(ImportSupplementalQuestionSchema).optional(),
});

export const AdoptPlanSummarySchema = z.object({
  moveCount: z.number().int(),
  layers: z.object({
    srs: z.number().int(),
    basicDesign: z.number().int(),
    detailDesign: z.number().int(),
    prototype: z.number().int(),
  }),
  lowConfidenceCount: z.number().int(),
  classification: z.object({
    srs: z.string(),
    basicDesign: z.string(),
    detailDesign: z.string(),
    prototype: z.string(),
    languages: z.object({
      detected: z.array(z.string()),
      strategy: z.string(),
    }),
    dataSource: z.string(),
    activePack: z.string(),
  }),
  warnings: z.array(z.string()),
});

export const StoredPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resolve"), plan: FullTaskPlanSchema }),
  z.object({ kind: z.literal("generate"), plan: GeneratePlanSchema }),
  z.object({ kind: z.literal("import"), plan: ImportPlanSchema }),
  z.object({ kind: z.literal("adopt"), plan: AdoptPlanSummarySchema }),
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
        .describe("Full criteria table shown (or readinessSummaryAcknowledged on greenfield bootstrap)"),
      readinessSummaryAcknowledged: z
        .boolean()
        .optional()
        .describe("Greenfield bootstrap: readiness_assess summary + blockingGaps presented"),
      greenfieldBootstrap: z.boolean().optional().describe("Auto-set on first greenfield generate session"),
      briefingConfirmedAt: z
        .string()
        .optional()
        .describe("ISO timestamp when user confirmed context briefing — required before briefing step done"),
      planPresentedAt: z
        .string()
        .optional()
        .describe("ISO timestamp when plan table was shown — required before task_approve_plan"),
      extractOffered: z
        .boolean()
        .optional()
        .describe("Set after offering spec_record — required before task_complete"),
      adoptedAt: z.string().optional().describe("Set when adopt workflow migrated docs"),
      resolveTier: ResolveTierEnum.optional().describe(
        "Resolve-task depth: fast | standard | full — set via task_confirm_tier or task_update",
      ),
      tierConfirmedAt: z
        .string()
        .optional()
        .describe("ISO timestamp when user confirmed Fast/Standard/Full tier"),
      designSpecPath: z
        .string()
        .optional()
        .describe("Full tier: path to design spec under docs/superpowers/specs/"),
      designSpecApprovedAt: z
        .string()
        .optional()
        .describe("Full tier: ISO timestamp when user approved the design spec"),
      implementationPlanPath: z
        .string()
        .optional()
        .describe("Standard/Full tier: path to plan file under docs/superpowers/plans/"),
      executionMode: ResolveExecutionModeEnum.optional().describe(
        "Standard/Full tier after plan approval: inline or subagent execution",
      ),
      packDesignSpecPath: z.string().optional(),
      packDesignSpecApprovedAt: z.string().optional(),
      importPlanPath: z.string().optional(),
      scanResultHash: z.string().optional(),
      scanConfirmedAt: z.string().optional(),
      manifestPlanPresentedAt: z.string().optional(),
      manifestPlanApprovedAt: z.string().optional(),
      skillBriefingConfirmedAt: z.string().optional(),
      stagedSkillPath: z.string().optional(),
      contextMapResolvedAt: z.string().optional(),
      readinessReviewedAt: z.string().optional(),
      packValidateReadyAt: z.string().optional(),
      aspectCoverageConfirmedAt: z.string().optional(),
    })
    .optional(),
  step: z.object({ id: z.string(), patch: TaskStepPatchSchema }).optional(),
});

export const TaskCreateSchema = RootSchema.extend({
  kind: TaskKindEnum.describe("generate (SRS/basic-design) | resolve (incremental) | import (template pack)"),
  workflow: WorkflowIdEnum.describe(
    "Workflow template to initialize steps from (generate-srs, resolve, template-import, …)",
  ),
  trigger: z.string().describe("Original user intent that started this task"),
  docType: z.string().optional().describe("Doc type for generate workflows (e.g. srs)"),
  force: z
    .boolean()
    .optional()
    .describe("Replace existing active task in the same slot (abandons the previous task)"),
  ...DeriveBootstrapFields,
});

/** WorkCreateSchema extends TaskCreateSchema to also accept kind "change" (alias for "resolve"). */
export const WorkKindEnum = z.enum(["generate", "resolve", "import", "adopt", "change"]);
export const WorkCreateSchema = RootSchema.extend({
  kind: WorkKindEnum.describe(
    "generate | resolve | import | adopt | change (alias for resolve)",
  ),
  workflow: WorkflowIdEnum.describe(
    "Workflow template to initialize steps from (generate-srs, resolve, template-import, …)",
  ),
  trigger: z.string().describe("Original user intent that started this work item"),
  docType: z.string().optional().describe("Doc type for generate workflows (e.g. srs)"),
  force: z
    .boolean()
    .optional()
    .describe("Replace existing active task in the same slot (abandons the previous task)"),
  ...DeriveBootstrapFields,
});

const TaskListBootstrapSchema = z.object({
  kind: TaskKindEnum.describe("generate | resolve | import"),
  workflow: WorkflowIdEnum.describe(
    "Workflow template for the new task (e.g. generate-srs, resolve, template-import)",
  ),
  trigger: z.string().describe("User intent that started this workflow"),
  docType: z.string().optional().describe("Doc type for generate workflows (e.g. srs)"),
  force: z
    .boolean()
    .optional()
    .describe("Replace existing active task in the slot (abandons the previous task)"),
  ...DeriveBootstrapFields,
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
  ...AuditActorOverrideSchema,
});

export const TaskConfirmTierSchema = RootSchema.extend({
  taskId: z.string().describe("Resolve task id"),
  tier: ResolveTierEnum.describe("User-confirmed tier: fast | standard | full"),
});

export const TaskApproveDesignSpecSchema = RootSchema.extend({
  taskId: z.string().describe("Resolve task id (Full tier)"),
  designSpecPath: z
    .string()
    .describe("Relative path to approved design spec, e.g. docs/superpowers/specs/2026-06-17-topic-design.md"),
});

export const TaskApproveImportPlanSchema = RootSchema.extend({
  taskId: z.string().describe("Import task id"),
  plan: StoredPlanSchema.optional().describe("ImportPlan to approve; omit if already set via task_update"),
  ...AuditActorOverrideSchema,
});

export const TaskApproveAdoptPlanSchema = RootSchema.extend({
  taskId: z.string().describe("Adopt task id"),
  plan: StoredPlanSchema.optional().describe("AdoptPlanSummary to approve; omit if already set via task_update"),
  by: z.string().optional().describe("Approver identity"),
});

export const TaskApprovePackDesignSchema = RootSchema.extend({
  taskId: z.string().describe("Import task id"),
  designSpecPath: z
    .string()
    .describe("Relative path to approved pack design spec, e.g. docs/superpowers/specs/2026-06-18-my-pack-design.md"),
});

export const TaskSetExecutionModeSchema = RootSchema.extend({
  taskId: z.string().describe("Resolve task id with approved plan"),
  mode: ResolveExecutionModeEnum.describe("inline or subagent — Standard/Full only"),
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

export const TemplateInferSchema = RootSchema.extend({
  json: z.boolean().optional().describe("Return full clarify-profile as JSON"),
});

export const TemplateScanSchema = RootSchema.extend({
  sourcePath: z.string().describe("Path to folder of .md template files"),
});

export const TemplateInstallSchema = RootSchema.extend({
  name: z.string().optional().describe("Override pack name (default: manifest packName)"),
  dryRun: z.boolean().optional().describe("Validate staging without copying to packs/"),
  legacy: z
    .boolean()
    .optional()
    .describe("Bypass import-task gates (human CLI escape hatch)"),
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
  sourceMode: SourceModeEnum.optional(),
  deriveFrom: z.array(DeriveLayerEnum).optional(),
  derivePhase: DerivePhaseEnum.optional(),
  workflow: z.string().optional().describe("Workflow id for default deriveFrom layers"),
  verbose: z
    .boolean()
    .optional()
    .describe("Include full criteria[] table (default false — returns summary + blockingGaps only)"),
});

export const ReadinessOutputChecklistSchema = RootSchema.extend({
  docType: z
    .string()
    .optional()
    .describe("Document type (default: srs)"),
  profile: z.string().optional().describe("Tailoring profile override"),
  logicalPath: z
    .string()
    .optional()
    .describe("Review logical path (e.g. srs/01-overview) — improves custom checklist matching"),
  paths: z
    .array(z.string())
    .describe("Generated doc paths just written — agent scores checklist items semantically"),
});

// ── Project adopt ─────────────────────────────────────────────────────────────

export const AdoptScanSchema = RootSchema;

export const AdoptPlanSchema = RootSchema.extend({
  approve: z
    .boolean()
    .optional()
    .describe("Approve plan after generation (Gate 2); equivalent to adopt plan --approve"),
  sync: z
    .boolean()
    .optional()
    .describe("Refresh heuristics from scan (overwrite draft plan)"),
  by: z.string().optional().describe("Approver identity when approve is true"),
});

export const AdoptApplySchema = RootSchema.extend({
  dryRun: z.boolean().optional().describe("Preview moves without changing files"),
  legacy: z.boolean().optional().describe("Bypass adopt task gates (scripts/CI only)"),
});

export const AdoptBootstrapSchema = RootSchema.extend({
  skipAnalyze: z.boolean().optional().describe("Skip optional analyze step"),
  legacy: z.boolean().optional().describe("Bypass adopt task gates (scripts/CI only)"),
});

export const AdoptValidateSchema = RootSchema.extend({
  sync: z
    .boolean()
    .optional()
    .describe("Update adopt-setup.json from plan status"),
});

export const AdoptSetupMarkSchema = RootSchema.extend({
  itemId: z
    .string()
    .describe('Adopt setup item id, e.g. "plan.approved", "migration.complete"'),
});

export const AdoptContextRecordSchema = RootSchema.extend({
  id: z.string().describe("Context question id from scan (e.g. lang-primary)"),
  answer: z.string().describe("Human answer to store in adopt context.json"),
});

export const UpgradeScanSchema = RootSchema.extend({
  target: z.string().optional().describe("Target package version (default: installed)"),
});

export const UpgradeApplySchema = RootSchema.extend({
  auto: z.boolean().optional().describe("Apply all auto-fixable checklist items (default true)"),
  items: z.array(z.string()).optional().describe("Subset of checklist item IDs to apply"),
});

export const UpgradeValidateSchema = RootSchema;

export const UpgradeSetupMarkSchema = RootSchema.extend({
  itemId: z
    .string()
    .describe('Upgrade item id, e.g. "UPG-030", "upgrade.confirmed", "upgrade.complete"'),
});

// ── Design layer sync ─────────────────────────────────────────────────────────

export const SyncSnapshotSchema = RootSchema.extend({
  label: z.string().optional().describe("Human label for this baseline"),
  gitRef: z.string().optional().describe("Git ref to store (default: HEAD)"),
  force: z.boolean().optional().describe("Overwrite existing baseline"),
});

export const SyncAuditSchema = RootSchema.extend({
  failOnDrift: z
    .boolean()
    .optional()
    .describe("Return error when drift detected (CI gate)"),
  direction: z
    .enum(["downstream", "upstream", "both"])
    .optional()
    .describe("Impact direction — default both when basic/detail design changed"),
  verifyGitRef: z
    .boolean()
    .optional()
    .describe("Warn if HEAD is not descendant of baseline gitRef"),
});

// ── Workflow routing ──────────────────────────────────────────────────────────

export const WorkflowRouteSchema = RootSchema.extend({
  message: z
    .string()
    .describe("User message or intent to classify (e.g. 'approve it', '/review', 'resolve C-012')"),
});

export const WorkflowStatusSchema = RootSchema;

// ── Lifecycle sync ────────────────────────────────────────────────────────────

export const LifecycleSyncSchema = RootSchema.extend({
  dryRun: z
    .boolean()
    .optional()
    .describe("Reconcile lifecycle steps without writing .docops/lifecycle.json"),
});

// ── Contract tools ────────────────────────────────────────────────────────────

export const ContractReviewSchema = RootSchema.extend({
  action: z
    .enum([
      "check",
      "status",
      "approve",
      "decline",
      "close",
      "reject",
      "queue",
      "list",
      "begin",
      "config",
      "session_start",
      "session_ack",
      "withdraw",
      "reopen",
    ])
    .describe("Review operation to perform"),
  logicalPath: z.string().optional().describe("Logical document path (e.g. srs/01-overview)"),
  track: z.enum(["internal", "client", "all"]).optional().describe("Review track"),
  ...AuditActorOverrideSchema,
  note: z.string().optional().describe("Approve/decline note"),
  reason: z.string().optional().describe("Close/reject reason"),
  showDiff: z.boolean().optional().describe("Include diff content (default: true)"),
  includeHistory: z.boolean().optional().describe("Include approval history events"),
  historyLimit: z.number().int().min(0).optional().describe("Max history entries to return"),
  historySince: z.string().optional().describe("Only return history entries after this ISO timestamp"),
  enrich: z.boolean().optional().describe("Compute git diff and graph impact (default: true when showDiff)"),
  status: z.string().optional().describe("Filter status for list action (pending, approved, all)"),
  prefix: z.string().optional().describe("Logical path prefix for list action"),
});

export const ContractCommentsSchema = RootSchema.extend({
  action: z
    .enum([
      "list",
      "inbox",
      "show",
      "resolve",
      "facets",
      "batch_plan",
      "batch_resolve",
      "create",
      "reply",
    ])
    .describe("Comment operation to perform"),
  filePath: z
    .string()
    .optional()
    .describe("Filter by file path (use `prototype` for all prototype threads)"),
  pathPrefix: z.string().optional().describe("Logical path prefix (e.g. srs/, prototype/src/)"),
  commentTypes: z
    .array(z.enum(["document", "prototype"]))
    .optional()
    .describe("Filter by comment type"),
  screen: z.string().optional().describe("Prototype screen stem or URL fragment (e.g. login)"),
  originBranch: z.string().optional().describe("Filter by originBranch"),
  anchorState: z
    .enum(["active", "drifted", "missing"])
    .optional()
    .describe("Filter by anchor health"),
  status: z
    .enum(["open", "resolved", "all"])
    .optional()
    .describe("Filter by status (default: open)"),
  groupByScreen: z
    .boolean()
    .optional()
    .describe("Add B-00N batch rows grouped by prototype screen"),
  threadId: z.string().optional().describe("Comment thread id (required for show/resolve/reply)"),
  entityId: z.string().optional().describe("Document registry entityId"),
  screenId: z.string().optional().describe("Prototype screenId"),
  body: z.string().optional().describe("Comment or reply body (required for create/reply)"),
  startLine: z.number().int().min(1).optional().describe("Document anchor start line (create)"),
  endLine: z.number().int().min(1).optional().describe("Document anchor end line (create)"),
  language: z.string().optional().describe("Document anchor language code (create, default EN)"),
  expectedVersion: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optimistic lock on meta_data.json version (reply)"),
  ...AuditActorOverrideSchema,
  resolvedBy: z.string().optional().describe("Deprecated alias for by"),
  dryRun: z.boolean().optional().describe("Preview resolution without writing"),
  batchId: z.string().optional().describe("Batch pick id B-001"),
  picks: z.array(z.string()).optional().describe("B-00N or C-00N pick ids"),
  phrase: z.string().optional().describe("Natural phrase e.g. login screen"),
});

export const ContractPrototypeSchema = RootSchema.extend({
  action: z.string().describe("Prototype operation to perform"),
});

export const ContractTranslateSchema = RootSchema.extend({
  action: z
    .enum(["lang_queue"])
    .describe("Translate operation to perform"),
  lang: z.string().optional().describe("Filter by language code (e.g. 'jp', 'vi')"),
  limit: z.number().int().min(1).optional().describe("Max pending jobs to return (default: all)"),
  status: z
    .enum(["pending", "failed", "resolved", "all"])
    .optional()
    .describe("Which queue to read (default: pending)"),
  enrich: z
    .boolean()
    .optional()
    .describe("Compute git diff and graph impact on pending jobs (default: true)"),
});
