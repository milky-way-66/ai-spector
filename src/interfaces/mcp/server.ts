#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";

import {
  GraphQuerySchema,
  GraphImpactSchema,
  GraphValidateSchema,
  GraphMergeSchema,
  GraphReportSchema,
  IndexSchema,
  KnowledgeStatusSchema,
  KnowledgeValidateSchema,
  KnowledgeSchemaSchema,
  LangQueueSchema,
  CommentsListSchema,
  CommentsFacetsSchema,
  CommentsBatchPlanSchema,
  CommentsBatchResolveSchema,
  CommentsInboxSchema,
  CommentsShowSchema,
  CommentsResolveSchema,
  TemplateListSchema,
  TemplateInspectSchema,
  TemplateValidateSchema,
  TemplateSetupMarkSchema,
  TemplateInferSchema,
  TemplateScanSchema,
  TemplateInstallSchema,
  ReadinessAssessSchema,
  ReadinessConfigSchema,
  ReadinessScanSchema,
  ReadinessProfilesListSchema,
  ReadinessCriteriaSchema,
  ReadinessOutputChecklistSchema,
  UpgradeScanSchema,
  UpgradeApplySchema,
  UpgradeValidateSchema,
  UpgradeSetupMarkSchema,
  SyncSnapshotSchema,
  SyncAuditSchema,
  LifecycleSyncSchema,
  DocsSearchSchema,
  GraphQueryFuzzySchema,
  CocoindexStatusSchema,
  CocoindexStatsSchema,
  CocoindexIndexSchema,
  ResolveTaskSchema,
  ReviewApproveSchema,
  ReviewDeclineSchema,
  ReviewCloseSchema,
  ReviewStatusSchema,
  ReviewQueueSchema,
  ReviewCheckSchema,
  ReviewBeginSchema,
  ReviewRejectSchema,
  ReviewListSchema,
  ReviewSessionStartSchema,
  ReviewSessionAckReviewSchema,
  ReviewWithdrawSchema,
  ReviewReopenSchema,
  ReviewConfigSchema,
  WorkspaceCheckSchema,
  ContextListSchema,
  ContextRecordSchema,
  ContextResolveSchema,
  SpecListSchema,
  SpecRecordSchema,
  SpecApproveSchema,
  SpecRejectSchema,
  TaskCreateSchema,
  TaskListSchema,
  TaskStatusSchema,
  TaskGetSchema,
  TaskUpdateSchema,
  TaskApprovePlanSchema,
  TaskConfirmTierSchema,
  TaskApproveDesignSpecSchema,
  TaskApproveImportPlanSchema,
  TaskApprovePackDesignSchema,
  TaskSetExecutionModeSchema,
  TaskPauseSchema,
  TaskResumeSchema,
  TaskCompleteSchema,
  TaskAbandonSchema,
  TaskRecordWaveSchema,
  WorkCreateSchema,
  WorkflowRouteSchema,
  WorkflowStatusSchema,
  ContractReviewSchema,
  ContractCommentsSchema,
  ContractPrototypeSchema,
  ContractTranslateSchema,
} from "./schemas.js";

import { toolGraphQuery, toolGraphImpact, toolGraphValidate, toolGraphMerge, toolGraphReport } from "./tools/graph.js";
import { toolKnowledgeStatus, toolKnowledgeValidate, toolKnowledgeSchema } from "./tools/analyze.js";
import { toolLangQueue } from "./tools/lang.js";
import { toolIndex } from "./tools/index.js";
import {
  toolCommentsList,
  toolCommentsFacets,
  toolCommentsInbox,
  toolCommentsBatchPlan,
  toolCommentsBatchResolve,
  toolCommentsShow,
  toolCommentsResolve,
} from "./tools/comments.js";
import {
  toolTemplateList,
  toolTemplateInspect,
  toolTemplateValidate,
  toolTemplateSetupMark,
  toolTemplateInfer,
  toolTemplateScan,
  toolTemplateInstall,
} from "./tools/template.js";
import {
  toolReadinessAssess,
  toolReadinessConfig,
  toolReadinessScan,
  toolReadinessProfilesList,
  toolReadinessGetCriteria,
  toolReadinessOutputChecklist,
} from "./tools/readiness.js";
import {
  toolUpgradeScan,
  toolUpgradeApply,
  toolUpgradeValidate,
  toolUpgradeSetupMark,
} from "./tools/upgrade.js";
import { toolSyncSnapshot, toolSyncAudit } from "./tools/sync.js";
import { toolLifecycleSync } from "./tools/lifecycle.js";
import { toolDocsSearch, toolGraphQueryFuzzy, toolCocoindexStatus, toolCocoindexStats, toolCocoindexIndex } from "./tools/cocoindex.js";
import { toolResolveTask } from "./tools/resolve-task.js";
import { toolWorkspaceCheck } from "./tools/check.js";
import { toolContextList, toolContextRecord, toolContextResolve } from "./tools/context.js";
import { toolSpecList, toolSpecRecord, toolSpecApprove, toolSpecReject } from "./tools/extracted.js";
import {
  toolTaskAbandon,
  toolTaskApproveDesignSpec,
  toolTaskApproveImportPlan,
  toolTaskApprovePackDesign,
  toolTaskApprovePlan,
  toolTaskComplete,
  toolTaskConfirmTier,
  toolTaskCreate,
  toolTaskGet,
  toolTaskList,
  toolTaskStatus,
  toolTaskPause,
  toolTaskResume,
  toolTaskSetExecutionMode,
  toolTaskUpdate,
  toolTaskRecordWave,
} from "./tools/task.js";
import {
  toolWorkCreate,
  toolWorkList,
  toolWorkStatus,
  toolWorkGet,
  toolWorkUpdate,
  toolWorkApprovePlan,
  toolWorkRecordStep,
  toolWorkPause,
  toolWorkResume,
  toolWorkComplete,
  toolWorkAbandon,
} from "./tools/work.js";
import {
  toolReviewApprove,
  toolReviewDecline,
  toolReviewClose,
  toolReviewStatus,
  toolReviewQueue,
  toolReviewCheck,
  toolReviewBegin,
  toolReviewReject,
  toolReviewList,
  toolReviewSessionStart,
  toolReviewSessionAckReview,
  toolReviewWithdraw,
  toolReviewReopen,
  toolReviewConfig,
} from "./tools/reviews.js";
import { toolWorkflowRoute } from "./tools/workflow-route.js";
import { toolWorkflowStatus } from "./tools/workflow-status.js";
import {
  toolContractReview,
  toolContractComments,
  toolContractPrototype,
  toolContractTranslate,
} from "./tools/contract.js";
import {
  APPROVE_TOOL_DESCRIPTIONS,
  REVIEW_WORKFLOW_TOOL_DESCRIPTIONS,
  UPGRADE_TOOL_DESCRIPTIONS,
  SYNC_TOOL_DESCRIPTIONS,
  LIFECYCLE_TOOL_DESCRIPTIONS,
} from "./tool-descriptions.js";
import { MCP_TOOL_NAMES } from "./tool-names.js";
import { mcpToolErrorContent } from "./format-tool-error.js";
import { assertToolAllowed } from "./assert-tool-allowed.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };

const server = new McpServer({
  name: "ai-spector",
  version: pkg.version,
});

// ── Graph tools ───────────────────────────────────────────────────────────────

server.registerTool(
  "graph_query",
  {
    description: "Walk the traceability graph from a seed node and return connected nodes and edges",
    inputSchema: GraphQuerySchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphQuery(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "graph_impact",
  {
    description:
      "Compute impact analysis for a change — returns which documents/sections need to be regenerated or reviewed",
    inputSchema: GraphImpactSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphImpact(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "graph_validate",
  {
    description: "Validate the traceability graph against schema and traceability rules",
    inputSchema: GraphValidateSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphValidate(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "graph_merge",
  {
    description: "Merge AI-extracted knowledge (knowledge.json) into the traceability graph",
    inputSchema: GraphMergeSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphMerge(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "graph_report",
  {
    description:
      "Audit graph layer health — returns provenance coverage, hub completeness, empty domain layers, and missing traceability links",
    inputSchema: GraphReportSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphReport(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

// ── Knowledge tools ───────────────────────────────────────────────────────────

server.registerTool(
  "knowledge_status",
  {
    description:
      "Check whether knowledge.json is present and report entity counts (actors, useCases, features, …). Use before graph_merge to confirm extraction is complete.",
    inputSchema: KnowledgeStatusSchema.shape,
  },
  async (input) => {
    const result = await toolKnowledgeStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "knowledge_validate",
  {
    description:
      "Validate knowledge.json against schema.knowledge.json and return any errors or warnings. Run after entity extraction and before graph_merge.",
    inputSchema: KnowledgeValidateSchema.shape,
  },
  async (input) => {
    const result = await toolKnowledgeValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "knowledge_schema",
  {
    description:
      "Return the knowledge.json schema, default listedInSection IDs, valid section IDs from the project registry, example payload, and shape docs for gaps.json and scope.json. Call this before writing knowledge.json to avoid guessing field names or section anchors.",
    inputSchema: KnowledgeSchemaSchema.shape,
  },
  async (input) => {
    const result = await toolKnowledgeSchema(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Lang queue tool ───────────────────────────────────────────────────────────

server.registerTool(
  "lang_queue",
  {
    description:
      "Read the translation queue — returns pending/failed/resolved jobs and summary counts. Use after doc edits or before starting translation work to see what needs updating.",
    inputSchema: LangQueueSchema.shape,
  },
  async (input) => {
    const result = await toolLangQueue(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Index tool ────────────────────────────────────────────────────────────────

server.registerTool(
  "index",
  {
    description: "Re-index the project: rebuild graph structure, merge knowledge, build doc indexes",
    inputSchema: IndexSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolIndex(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

// ── Comment tools ─────────────────────────────────────────────────────────────

server.registerTool(
  "comments_facets",
  {
    description:
      "List available comment filter facets (types, screens, paths, branches) with counts. Use before filtering inbox/list.",
    inputSchema: CommentsFacetsSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsFacets(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_list",
  {
    description: "List inline comment/feedback threads left on documents (notes, questions, annotations). These are NOT approval actions — use review_* tools for formal sign-off.",
    inputSchema: CommentsListSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_inbox",
  {
    description: "Get the structured inbox of inline comment/feedback threads (notes, questions, annotations on documents), with priority ordering. NOT related to the approval workflow — use review_* for formal sign-off.",
    inputSchema: CommentsInboxSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsInbox(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_batch_plan",
  {
    description:
      "Build a batch resolve plan for prototype comment thread(s) on one or more screens. " +
      "Returns clarify prompts, approach guidance, and resolve steps — no file writes. " +
      "Use B-001, picks array, or screen filter.",
    inputSchema: CommentsBatchPlanSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsBatchPlan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_batch_resolve",
  {
    description:
      "Mark multiple prototype comment threads resolved after HTML edits are committed. " +
      "Pass B-00N or C-00N pick ids from inbox.",
    inputSchema: CommentsBatchResolveSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsBatchResolve(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_show",
  {
    description: "Get full detail of a single inline comment/feedback thread by id. Comments are annotations on documents, not approval decisions.",
    inputSchema: CommentsShowSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsShow(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "comments_resolve",
  {
    description: APPROVE_TOOL_DESCRIPTIONS.comments_resolve,
    inputSchema: CommentsResolveSchema.shape,
  },
  async (input) => {
    const result = await toolCommentsResolve(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Template tools ────────────────────────────────────────────────────────────

server.registerTool(
  "template_list",
  {
    description:
      "List template packs (active SRS/basic-design), per-pack setup status, staging artifacts, active import task, and suggestedNextTools for agents.",
    inputSchema: TemplateListSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_inspect",
  {
    description: "Inspect a template pack — manifest, documents, and setup validation gaps",
    inputSchema: TemplateInspectSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateInspect(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_validate",
  {
    description:
      "Validate custom pack setup — detect missing artifacts, manifest fields, graph prerequisites, context-map TODOs. Returns questionsForUser to ask before first generate. Use sync:true to refresh pack-setup.json.",
    inputSchema: TemplateValidateSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_setup_mark",
  {
    description:
      'Mark a pack-setup.json item done after user confirmation (e.g. itemId "readiness.reviewed")',
    inputSchema: TemplateSetupMarkSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateSetupMark(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_scan",
  {
    description:
      "Scan a folder of .md templates → scan-result.json in staging. Prefer this over CLI template scan when MCP is available.",
    inputSchema: TemplateScanSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateScan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_infer",
  {
    description:
      "Derive import aspect coverage from scan-result.json — smart clarify input. Writes clarify-profile.json to staging.",
    inputSchema: TemplateInferSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateInfer(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "template_install",
  {
    description:
      "Install staged template pack to .ai-spector/packs/ and activate SRS pack. Requires active import task + task_approve_import_plan unless legacy:true.",
    inputSchema: TemplateInstallSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateInstall(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Readiness assessment ──────────────────────────────────────────────────────

server.registerTool(
  "readiness_config",
  {
    description:
      "Active readiness configuration from docflow.config.json — profiles per doc type, criteria paths, profile drift vs last scan. Call first to see what is active.",
    inputSchema: ReadinessConfigSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessConfig(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "readiness_profiles_list",
  {
    description:
      "List tailoring profiles (general, regulated, arc42) for readiness assessment before clarify/generate.",
    inputSchema: ReadinessProfilesListSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessProfilesList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "readiness_scan",
  {
    description:
      "Scan existing generated documents against active readiness profile and completeness rules. Use after changing readiness.profile in config. Returns findings and suggestionsForUser. Set updateLastScan:true to record baseline.",
    inputSchema: ReadinessScanSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessScan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "readiness_get_criteria",
  {
    description:
      "Load merged readiness criteria JSON (base + tailoring profile) for a doc type.",
    inputSchema: ReadinessCriteriaSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessGetCriteria(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "readiness_assess",
  {
    description:
      "Structured readiness report: score criteria against graph, context store, and data-source. Default: summary + blockingGaps only; pass verbose:true for full criteria[] table. Run after scope selection, before clarify questions.",
    inputSchema: ReadinessAssessSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessAssess(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "readiness_output_checklist",
  {
    description:
      "Rubric for agent-driven output compliance after GENERATE. Maps each written path to DAG node, criterion IDs, ISO refs, and agentCheck prompts. Does NOT score file content — the agent reads the file and reports met/partial/missing. Use after readiness_scan, before task_record_wave.",
    inputSchema: ReadinessOutputChecklistSchema.shape,
  },
  async (input) => {
    const result = await toolReadinessOutputChecklist(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "upgrade_scan",
  {
    description: UPGRADE_TOOL_DESCRIPTIONS.upgrade_scan,
    inputSchema: UpgradeScanSchema.shape,
  },
  async (input) => {
    const result = await toolUpgradeScan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "upgrade_apply",
  {
    description: UPGRADE_TOOL_DESCRIPTIONS.upgrade_apply,
    inputSchema: UpgradeApplySchema.shape,
  },
  async (input) => {
    const result = await toolUpgradeApply(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "upgrade_validate",
  {
    description: UPGRADE_TOOL_DESCRIPTIONS.upgrade_validate,
    inputSchema: UpgradeValidateSchema.shape,
  },
  async (input) => {
    const result = await toolUpgradeValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "upgrade_setup_mark",
  {
    description: UPGRADE_TOOL_DESCRIPTIONS.upgrade_setup_mark,
    inputSchema: UpgradeSetupMarkSchema.shape,
  },
  async (input) => {
    const result = await toolUpgradeSetupMark(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Design layer sync ─────────────────────────────────────────────────────────

server.registerTool(
  "sync_snapshot",
  {
    description: SYNC_TOOL_DESCRIPTIONS.sync_snapshot,
    inputSchema: SyncSnapshotSchema.shape,
  },
  async (input) => {
    const result = await toolSyncSnapshot(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "sync_audit",
  {
    description: SYNC_TOOL_DESCRIPTIONS.sync_audit,
    inputSchema: SyncAuditSchema.shape,
  },
  async (input) => {
    const result = await toolSyncAudit(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "lifecycle_sync",
  {
    description: LIFECYCLE_TOOL_DESCRIPTIONS.lifecycle_sync,
    inputSchema: LifecycleSyncSchema.shape,
  },
  async (input) => {
    const result = await toolLifecycleSync(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── CocoIndex tools ───────────────────────────────────────────────────────────

server.registerTool(
  "cocoindex_status",
  {
    description:
      "Check whether CocoIndex is configured and ready: Python version, dependencies installed, index built. Use to diagnose why cocoindexSync was skipped or docs_search returned no results.",
    inputSchema: CocoindexStatusSchema.shape,
  },
  async (input) => {
    const result = await toolCocoindexStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "cocoindex_stats",
  {
    description:
      "Inspect the CocoIndex embedding store: chunk count, file count, and embedded file paths. Use to verify whether specific docs were embedded when docs_search returns no results.",
    inputSchema: CocoindexStatsSchema.shape,
  },
  async (input) => {
    const result = await toolCocoindexStats(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "cocoindex_index",
  {
    description:
      "Run the CocoIndex pipeline update — rebuilds semantic embeddings from project docs. Call after adding or editing doc files. Equivalent to `npx ai-spector cocoindex index`.",
    inputSchema: CocoindexIndexSchema.shape,
  },
  async (input) => {
    const result = await toolCocoindexIndex(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "docs_search",
  {
    description:
      "Semantic search over project documentation. Returns matching sections with similarity scores and traceability graph node IDs. Requires CocoIndex to be set up (npx ai-spector cocoindex setup).",
    inputSchema: DocsSearchSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolDocsSearch(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "graph_query_fuzzy",
  {
    description:
      "Find a graph node by natural language description, then return its subgraph. Combines semantic doc search with graph traversal in one call. Requires CocoIndex (npx ai-spector cocoindex setup).",
    inputSchema: GraphQueryFuzzySchema.shape,
  },
  async (input) => {
    try {
      const result = await toolGraphQueryFuzzy(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

// ── Resolve task tool ─────────────────────────────────────────────────────────

server.registerTool(
  "resolve_task",
  {
    description:
      "Execute approved resolve-task MCP steps (index, graph_merge, graph_impact, graph_report). Prefer taskId after task_approve_plan. Edit steps are done outside this tool. Returns workflowGuidance for verify/complete.",
    inputSchema: ResolveTaskSchema.shape,
  },
  async (input) => {
    const result = await toolResolveTask(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Review tools ─────────────────────────────────────────────────────────────

server.registerTool(
  "review_approve",
  {
    description: APPROVE_TOOL_DESCRIPTIONS.review_approve,
    inputSchema: ReviewApproveSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewApprove(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_decline",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_decline,
    inputSchema: ReviewDeclineSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewDecline(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_close",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_close,
    inputSchema: ReviewCloseSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewClose(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_withdraw",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_withdraw,
    inputSchema: ReviewWithdrawSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewWithdraw(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_reopen",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_reopen,
    inputSchema: ReviewReopenSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewReopen(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_config",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_config,
    inputSchema: ReviewConfigSchema.shape,
  },
  async (input) => {
    const result = await toolReviewConfig(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_status",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_status,
    inputSchema: ReviewStatusSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewStatus(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_queue",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_queue,
    inputSchema: ReviewQueueSchema.shape,
  },
  async (input) => {
    const result = await toolReviewQueue(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_check",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_check,
    inputSchema: ReviewCheckSchema.shape,
  },
  async (input) => {
    const result = await toolReviewCheck(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_begin",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_begin,
    inputSchema: ReviewBeginSchema.shape,
  },
  async (input) => {
    const result = await toolReviewBegin(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_reject",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_reject,
    inputSchema: ReviewRejectSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewReject(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "review_list",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_list,
    inputSchema: ReviewListSchema.shape,
  },
  async (input) => {
    const result = await toolReviewList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_session_start",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_session_start,
    inputSchema: ReviewSessionStartSchema.shape,
  },
  async (input) => {
    const result = await toolReviewSessionStart(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_session_ack_review",
  {
    description: REVIEW_WORKFLOW_TOOL_DESCRIPTIONS.review_session_ack_review,
    inputSchema: ReviewSessionAckReviewSchema.shape,
  },
  async (input) => {
    try {
      const result = await toolReviewSessionAckReview(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

// ── Workflow routing ──────────────────────────────────────────────────────────

server.registerTool(
  "workflow_route",
  {
    description: [
      "Classify user intent to the correct ai-spector skill and MCP tools before loading runbooks.",
      "",
      "WHEN: Ambiguous approve/review/continue message; unsure which skill to activate; after user says 'help me approve'.",
      "NOT WHEN: Intent is already clear (use the target tool directly).",
      "Reads review session (.session.json) and active task context. Returns skill, confidence, nextTools, avoidTools, or askUser with four approve options.",
    ].join("\n"),
    inputSchema: WorkflowRouteSchema.shape,
  },
  async (input) => {
    const result = await toolWorkflowRoute(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "workflow_status",
  {
    description: [
      "Current active subagent worker and recent phase transitions (.ai-spector/.docflow/workflow-active.json).",
      "",
      "WHEN: Orchestrator session start, after delegating a worker, or to show status line to the user.",
      "NOT WHEN: Classifying new intent — use workflow_route instead.",
      "Returns statusLine (e.g. 'Active worker: doc-review (reviewing srs/01-overview)').",
    ].join("\n"),
    inputSchema: WorkflowStatusSchema.shape,
  },
  async (input) => {
    const result = await toolWorkflowStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Workspace check ───────────────────────────────────────────────────────────

server.registerTool(
  "workspace_check",
  {
    description:
      "Validate workspace structure and config (required directories, docflow.config.json, language output folders, doc output paths under docs/{type}/{lang}/, templates, context store, graph.json parseability). Pass paths:[...] after writing a doc to verify location. Structure/config only — use graph_validate for graph semantics. Pass fix:true to auto-create missing directories. Runs in pre-commit too.",
    inputSchema: WorkspaceCheckSchema.shape,
  },
  async (input) => {
    const result = await toolWorkspaceCheck(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "context_list",
  {
    description:
      "List clarification context entries (questions asked before document generation, with answers and status open/answered/stale). Filter by docType and/or status. Use before generating documents to find unanswered or stale clarifications.",
    inputSchema: ContextListSchema.shape,
  },
  async (input) => {
    const result = await toolContextList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "context_record",
  {
    description:
      "Record a clarifying question in the context store (.ai-spector/.docflow/context/<docType>.json). Pass answer to record an already-answered clarification in one step; omit it to record an open question. Use during the Clarify stage before document generation.",
    inputSchema: ContextRecordSchema.shape,
  },
  async (input) => {
    const result = await toolContextRecord(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "context_resolve",
  {
    description:
      "Answer an open or stale clarification entry by id (e.g. Q-001), marking it answered with timestamp.",
    inputSchema: ContextResolveSchema.shape,
  },
  async (input) => {
    const result = await toolContextResolve(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "spec_list",
  {
    description:
      "List extracted specs in the review queue (key decisions/constraints extracted from generated documents, status pending/approved/rejected). Filter by docType and/or status. Use after document generation to show the user what is awaiting spec approval.",
    inputSchema: SpecListSchema.shape,
  },
  async (input) => {
    const result = await toolSpecList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "spec_record",
  {
    description:
      "Queue extracted specs as pending review (.ai-spector/.docflow/extracted/<docType>.json). Each spec is a statement plus the generated document(s) it came from, optionally with a graph patch to merge on approval. Specs are NEVER written to docs/data-source/.",
    inputSchema: SpecRecordSchema.shape,
  },
  async (input) => {
    const result = await toolSpecRecord(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "spec_approve",
  {
    description: APPROVE_TOOL_DESCRIPTIONS.spec_approve,
    inputSchema: SpecApproveSchema.shape,
  },
  async (input) => {
    const result = await toolSpecApprove(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "spec_reject",
  {
    description: "Reject a pending extracted spec by id — it is kept for audit but never merged.",
    inputSchema: SpecRejectSchema.shape,
  },
  async (input) => {
    const result = await toolSpecReject(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_create",
  {
    description:
      "Create a new workflow task persisted to .ai-spector/.docflow/tasks/<id>.json. Initializes steps from a workflow template (generate-srs, generate-basic-design, generate-detail-design, resolve, template-import, or generate-<pack>). One active task per slot unless force:true replaces the previous task.",
    inputSchema: TaskCreateSchema.shape,
  },
  async (input) => {
    const result = await toolTaskCreate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_list",
  {
    description:
      "List workflow tasks (active, paused, complete). Filter by status, kind, or workflow. Pass bootstrap to create a task when the slot is empty (single-call session start) or get activeForSlot when resumable work exists.",
    inputSchema: TaskListSchema.shape,
  },
  async (input) => {
    const result = await toolTaskList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_status",
  {
    description:
      "Show active workflow task slots (generate:srs, generate:basic-design, resolve) with phase, step, and plan approval — without opening JSON files.",
    inputSchema: TaskStatusSchema.shape,
  },
  async (input) => {
    const result = await toolTaskStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_get",
  {
    description:
      "Load full task state: current phase/step, plan approval, blockers, next action. Source of truth for resuming a paused workflow.",
    inputSchema: TaskGetSchema.shape,
  },
  async (input) => {
    const result = await toolTaskGet(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_update",
  {
    description:
      "Patch task state: advance phase, update a step, set goal/plan, record resolve-tier snapshots (resolveTier, implementationPlanPath, designSpecPath, executionMode). Prefer task_confirm_tier for tier confirmation.",
    inputSchema: TaskUpdateSchema.shape,
  },
  async (input) => {
    const result = await toolTaskUpdate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_approve_plan",
  {
    description: APPROVE_TOOL_DESCRIPTIONS.task_approve_plan,
    inputSchema: TaskApprovePlanSchema.shape,
  },
  async (input) => {
    const result = await toolTaskApprovePlan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_confirm_tier",
  {
    description:
      "Confirm resolve-task tier (fast | standard | full) after user picks. Sets snapshot.resolveTier + tierConfirmedAt, marks tier step done, skips check/design/briefing for Fast. Returns workflowGuidance for next gate.",
    inputSchema: TaskConfirmTierSchema.shape,
  },
  async (input) => {
    const result = await toolTaskConfirmTier(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_approve_design_spec",
  {
    description:
      "Full-tier resolve only: record approved design spec path (docs/superpowers/specs/…) and designSpecApprovedAt after user approves spec in chat. Advances to workspace_check.",
    inputSchema: TaskApproveDesignSpecSchema.shape,
  },
  async (input) => {
    const result = await toolTaskApproveDesignSpec(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_approve_import_plan",
  {
    description:
      "Import task only: approve manifest plan after user yes — sets planApprovedAt, marks manifest-plan done. NOT task_approve_plan.",
    inputSchema: TaskApproveImportPlanSchema.shape,
  },
  async (input) => {
    const result = await toolTaskApproveImportPlan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_approve_pack_design",
  {
    description:
      "Import task only: record approved pack design spec path after user yes — sets packDesignSpecApprovedAt, marks design done.",
    inputSchema: TaskApprovePackDesignSchema.shape,
  },
  async (input) => {
    const result = await toolTaskApprovePackDesign(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_set_execution_mode",
  {
    description:
      "Standard/Full resolve after task_approve_plan: record inline vs subagent execution (snapshot.executionMode). Fast tier is always inline.",
    inputSchema: TaskSetExecutionModeSchema.shape,
  },
  async (input) => {
    const result = await toolTaskSetExecutionMode(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_pause",
  {
    description: "Pause an active task so the user can stop and resume later.",
    inputSchema: TaskPauseSchema.shape,
  },
  async (input) => {
    const result = await toolTaskPause(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_resume",
  {
    description:
      "Resume a paused task: run workspace check, detect artifact drift since last snapshot, and list stale clarifications. Returns canContinue — user must confirm when drift or stale context is present.",
    inputSchema: TaskResumeSchema.shape,
  },
  async (input) => {
    const result = await toolTaskResume(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_complete",
  {
    description: "Mark a task complete and clear its active slot.",
    inputSchema: TaskCompleteSchema.shape,
  },
  async (input) => {
    const result = await toolTaskComplete(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_abandon",
  {
    description: "Abandon a task and clear its active slot.",
    inputSchema: TaskAbandonSchema.shape,
  },
  async (input) => {
    const result = await toolTaskAbandon(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "task_record_wave",
  {
    description:
      "Record generate-task wave completion: mark wave-N done, snapshot artifact hashes, advance to the next wave or extract step.",
    inputSchema: TaskRecordWaveSchema.shape,
  },
  async (input) => {
    const result = await toolTaskRecordWave(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── work_* tools (aliases for task_* with deprecation shims on task_*) ──────

server.registerTool(
  "work_create",
  {
    description:
      "Create a new workflow work item. Accepts kind 'change' as an alias for 'resolve'. Prefer work_* over deprecated task_* tools.",
    inputSchema: WorkCreateSchema.shape,
  },
  async (input) => {
    const result = await toolWorkCreate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_list",
  {
    description:
      "List work items (active, paused, complete). Alias for task_list. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskListSchema.shape,
  },
  async (input) => {
    const result = await toolWorkList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_get",
  {
    description:
      "Load full work item state. Alias for task_get. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskGetSchema.shape,
  },
  async (input) => {
    const result = await toolWorkGet(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_update",
  {
    description:
      "Patch work item state. Alias for task_update. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskUpdateSchema.shape,
  },
  async (input) => {
    const result = await toolWorkUpdate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_approve_plan",
  {
    description:
      "Approve a work item plan. Alias for task_approve_plan. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskApprovePlanSchema.shape,
  },
  async (input) => {
    const result = await toolWorkApprovePlan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_record_step",
  {
    description:
      "Record a generate-task wave/step completion. Alias for task_record_wave. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskRecordWaveSchema.shape,
  },
  async (input) => {
    const result = await toolWorkRecordStep(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_pause",
  {
    description:
      "Pause an active work item. Alias for task_pause. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskPauseSchema.shape,
  },
  async (input) => {
    const result = await toolWorkPause(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_resume",
  {
    description:
      "Resume a paused work item. Alias for task_resume. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskResumeSchema.shape,
  },
  async (input) => {
    const result = await toolWorkResume(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_complete",
  {
    description:
      "Mark a work item complete. Alias for task_complete. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskCompleteSchema.shape,
  },
  async (input) => {
    const result = await toolWorkComplete(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "work_abandon",
  {
    description:
      "Abandon a work item. Alias for task_abandon. Prefer work_* over deprecated task_* tools.",
    inputSchema: TaskAbandonSchema.shape,
  },
  async (input) => {
    const result = await toolWorkAbandon(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Contract tools ────────────────────────────────────────────────────────────

server.registerTool(
  "contract_review",
  {
    description:
      "Grouped review operations via action discriminator. Actions: check, status, approve, decline, close, reject, queue, list, begin, config, session_start, session_ack, withdraw, reopen. Requires review capability.",
    inputSchema: ContractReviewSchema.shape,
  },
  async (input) => {
    try {
      await assertToolAllowed("contract_review", input.root);
      const result = await toolContractReview(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "contract_comments",
  {
    description:
      "Grouped comment operations via action discriminator. Actions: list, inbox, show, resolve, facets, batch_plan, batch_resolve, create, reply. Requires comments capability.",
    inputSchema: ContractCommentsSchema.shape,
  },
  async (input) => {
    try {
      await assertToolAllowed("contract_comments", input.root);
      const result = await toolContractComments(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "contract_prototype",
  {
    description:
      "Grouped prototype operations via action discriminator. Requires prototype capability.",
    inputSchema: ContractPrototypeSchema.shape,
  },
  async (input) => {
    try {
      await assertToolAllowed("contract_prototype", input.root);
      const result = await toolContractPrototype(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

server.registerTool(
  "contract_translate",
  {
    description:
      "Grouped translation operations via action discriminator. Actions: lang_queue. Requires translate capability.",
    inputSchema: ContractTranslateSchema.shape,
  },
  async (input) => {
    try {
      await assertToolAllowed("contract_translate", input.root);
      const result = await toolContractTranslate(input);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return mcpToolErrorContent(err);
    }
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

// Log registered tools to stderr so users can verify the full tool set is loaded.
// Set AI_SPECTOR_MCP_DEBUG=1 to suppress (e.g. in tests that parse stderr).
if (process.env["AI_SPECTOR_MCP_DEBUG"] !== "0") {
  process.stderr.write(
    `[ai-spector-mcp] v${pkg.version} started — ${MCP_TOOL_NAMES.length} tools registered: ${MCP_TOOL_NAMES.join(", ")}\n`,
  );
}
