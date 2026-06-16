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
  CommentsInboxSchema,
  CommentsShowSchema,
  CommentsResolveSchema,
  TemplateListSchema,
  TemplateInspectSchema,
  TemplateValidateSchema,
  TemplateSetupMarkSchema,
  ReadinessAssessSchema,
  ReadinessConfigSchema,
  ReadinessScanSchema,
  ReadinessProfilesListSchema,
  ReadinessCriteriaSchema,
  ReadinessOutputChecklistSchema,
  AdoptScanSchema,
  AdoptPlanSchema,
  AdoptApplySchema,
  AdoptBootstrapSchema,
  AdoptValidateSchema,
  AdoptSetupMarkSchema,
  AdoptContextRecordSchema,
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
  TaskPauseSchema,
  TaskResumeSchema,
  TaskCompleteSchema,
  TaskAbandonSchema,
  TaskRecordWaveSchema,
  WorkflowRouteSchema,
  WorkflowStatusSchema,
} from "./schemas.js";

import { toolGraphQuery, toolGraphImpact, toolGraphValidate, toolGraphMerge, toolGraphReport } from "./tools/graph.js";
import { toolKnowledgeStatus, toolKnowledgeValidate, toolKnowledgeSchema } from "./tools/analyze.js";
import { toolLangQueue } from "./tools/lang.js";
import { toolIndex } from "./tools/index.js";
import {
  toolCommentsList,
  toolCommentsInbox,
  toolCommentsShow,
  toolCommentsResolve,
} from "./tools/comments.js";
import {
  toolTemplateList,
  toolTemplateInspect,
  toolTemplateValidate,
  toolTemplateSetupMark,
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
  toolAdoptScan,
  toolAdoptPlan,
  toolAdoptApply,
  toolAdoptBootstrap,
  toolAdoptValidate,
  toolAdoptSetupMark,
  toolAdoptContextRecord,
} from "./tools/adopt.js";
import { toolDocsSearch, toolGraphQueryFuzzy, toolCocoindexStatus, toolCocoindexStats, toolCocoindexIndex } from "./tools/cocoindex.js";
import { toolResolveTask } from "./tools/resolve-task.js";
import { toolWorkspaceCheck } from "./tools/check.js";
import { toolContextList, toolContextRecord, toolContextResolve } from "./tools/context.js";
import { toolSpecList, toolSpecRecord, toolSpecApprove, toolSpecReject } from "./tools/extracted.js";
import {
  toolTaskAbandon,
  toolTaskApprovePlan,
  toolTaskComplete,
  toolTaskCreate,
  toolTaskGet,
  toolTaskList,
  toolTaskStatus,
  toolTaskPause,
  toolTaskResume,
  toolTaskUpdate,
  toolTaskRecordWave,
} from "./tools/task.js";
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
  APPROVE_TOOL_DESCRIPTIONS,
  REVIEW_WORKFLOW_TOOL_DESCRIPTIONS,
  ADOPT_TOOL_DESCRIPTIONS,
} from "./tool-descriptions.js";
import { mcpToolErrorContent } from "./format-tool-error.js";

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
    const result = await toolGraphQuery(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
    const result = await toolGraphImpact(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "graph_validate",
  {
    description: "Validate the traceability graph against schema and traceability rules",
    inputSchema: GraphValidateSchema.shape,
  },
  async (input) => {
    const result = await toolGraphValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "graph_merge",
  {
    description: "Merge AI-extracted knowledge (knowledge.json) into the traceability graph",
    inputSchema: GraphMergeSchema.shape,
  },
  async (input) => {
    const result = await toolGraphMerge(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
    const result = await toolGraphReport(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
    const result = await toolIndex(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Comment tools ─────────────────────────────────────────────────────────────

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
    description: "List installed template packs and show which is active",
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
      "Structured readiness report: score criteria against graph, context store, and data-source. Returns blockingGaps, questionsForUser, and ready flag. Run after scope selection, before clarify questions. Prefer this over manual JSON review.",
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

// ── Project adopt ─────────────────────────────────────────────────────────────

server.registerTool(
  "adopt_scan",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_scan,
    inputSchema: AdoptScanSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptScan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_plan",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_plan,
    inputSchema: AdoptPlanSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptPlan(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_apply",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_apply,
    inputSchema: AdoptApplySchema.shape,
  },
  async (input) => {
    const result = await toolAdoptApply(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_bootstrap",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_bootstrap,
    inputSchema: AdoptBootstrapSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptBootstrap(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_validate",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_validate,
    inputSchema: AdoptValidateSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_setup_mark",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_setup_mark,
    inputSchema: AdoptSetupMarkSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptSetupMark(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "adopt_context_record",
  {
    description: ADOPT_TOOL_DESCRIPTIONS.adopt_context_record,
    inputSchema: AdoptContextRecordSchema.shape,
  },
  async (input) => {
    const result = await toolAdoptContextRecord(input);
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
    const result = await toolDocsSearch(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
    const result = await toolGraphQueryFuzzy(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Resolve task tool ─────────────────────────────────────────────────────────

server.registerTool(
  "resolve_task",
  {
    description:
      "Execute a structured resolve-task workflow: validate a GoalSpec + TaskPlan and run each step against registered executors (index, graph_merge, graph_impact, graph_report). Returns execution results and a state-update summary.",
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
      "Create a new workflow task persisted to .ai-spector/.docflow/tasks/<id>.json. Initializes steps from a workflow template (generate-srs, generate-basic-design, resolve). One active task per slot unless force:true replaces the previous task.",
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
      "Patch task state: advance phase, update a step, set goal/plan, record blockers or artifact snapshot. Keep file state in sync after each workflow gate.",
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

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

// Log registered tools to stderr so users can verify the full tool set is loaded.
// Set AI_SPECTOR_MCP_DEBUG=1 to suppress (e.g. in tests that parse stderr).
if (process.env["AI_SPECTOR_MCP_DEBUG"] !== "0") {
  const toolNames = [
    "graph_query", "graph_impact", "graph_validate", "graph_merge", "graph_report",
    "knowledge_status", "knowledge_validate", "knowledge_schema",
    "lang_queue", "index",
    "comments_list", "comments_inbox", "comments_show", "comments_resolve",
    "template_list", "template_inspect", "template_validate", "template_setup_mark",
    "readiness_config", "readiness_profiles_list", "readiness_get_criteria",
    "readiness_assess", "readiness_scan", "readiness_output_checklist",
    "adopt_scan", "adopt_plan", "adopt_apply", "adopt_bootstrap", "adopt_validate", "adopt_setup_mark", "adopt_context_record",
    "cocoindex_status", "cocoindex_stats", "cocoindex_index", "docs_search", "graph_query_fuzzy",
    "resolve_task",
    "review_approve", "review_decline", "review_close", "review_withdraw", "review_reopen", "review_config", "review_status", "review_queue", "review_check", "review_begin", "review_reject", "review_list",
    "review_session_start", "review_session_ack_review",
    "workflow_route", "workflow_status",
    "workspace_check",
    "context_list", "context_record", "context_resolve",
    "spec_list", "spec_record", "spec_approve", "spec_reject",
    "task_create", "task_list", "task_status", "task_get", "task_update", "task_approve_plan",
    "task_pause", "task_resume", "task_complete", "task_abandon", "task_record_wave",
  ];
  process.stderr.write(
    `[ai-spector-mcp] v${pkg.version} started — ${toolNames.length} tools registered: ${toolNames.join(", ")}\n`,
  );
}
