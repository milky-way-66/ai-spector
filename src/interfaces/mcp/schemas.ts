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

export const ResolveTaskSchema = RootSchema.extend({
  intent: z.string().describe("Free-form user intent (for context)"),
  goalSpec: GoalSpecSchema,
  plan: TaskPlanSchema,
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
});

export const ReviewQueueSchema = RootSchema.extend({
  track: z
    .enum(["internal", "client", "all"])
    .optional()
    .describe("Which queue to show (default: all)"),
  showDiff: z.boolean().optional().describe("Include diff content for pending entries (default: true)"),
});

export const ReviewCheckSchema = RootSchema;

export const ReviewRejectSchema = RootSchema.extend({
  logicalPath: z.string().describe("Logical document path to dismiss from internal queue"),
  reason: z.string().optional().describe("Why the change does not require re-approval"),
});

// ── Template ──────────────────────────────────────────────────────────────────

export const TemplateListSchema = RootSchema;

export const TemplateInspectSchema = RootSchema.extend({
  pack: z.string().describe("Pack name to inspect"),
});
