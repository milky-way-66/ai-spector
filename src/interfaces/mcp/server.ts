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
  DocsSearchSchema,
  GraphQueryFuzzySchema,
  CocoindexStatusSchema,
  CocoindexStatsSchema,
  CocoindexIndexSchema,
  ResolveTaskSchema,
  ReviewApproveSchema,
  ReviewStatusSchema,
  ReviewQueueSchema,
  ReviewCheckSchema,
  ReviewRejectSchema,
  ReviewListSchema,
  WorkspaceCheckSchema,
  ContextListSchema,
  ContextRecordSchema,
  ContextResolveSchema,
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
import { toolTemplateList, toolTemplateInspect } from "./tools/template.js";
import { toolDocsSearch, toolGraphQueryFuzzy, toolCocoindexStatus, toolCocoindexStats, toolCocoindexIndex } from "./tools/cocoindex.js";
import { toolResolveTask } from "./tools/resolve-task.js";
import { toolWorkspaceCheck } from "./tools/check.js";
import { toolContextList, toolContextRecord, toolContextResolve } from "./tools/context.js";
import {
  toolReviewApprove,
  toolReviewStatus,
  toolReviewQueue,
  toolReviewCheck,
  toolReviewReject,
  toolReviewList,
} from "./tools/reviews.js";

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
    description: "List review comment threads, optionally filtered by file or status",
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
    description: "Get the structured comment inbox with priority ordering and IDE presentation hints",
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
    description: "Get full detail of a single comment thread by id",
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
    description: "Resolve a comment thread",
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
    description: "Inspect a template pack — returns its manifest and available documents",
    inputSchema: TemplateInspectSchema.shape,
  },
  async (input) => {
    const result = await toolTemplateInspect(input);
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
    description: "Approve a document for internal review and move it to the client review queue",
    inputSchema: ReviewApproveSchema.shape,
  },
  async (input) => {
    const result = await toolReviewApprove(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_status",
  {
    description: "Get the review approval status of a document including both internal and client tracks, and the diff since last approval",
    inputSchema: ReviewStatusSchema.shape,
  },
  async (input) => {
    const result = await toolReviewStatus(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_queue",
  {
    description: "List documents pending review in internal and/or client queues",
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
    description: "Scan all approved documents for content changes and invalidate stale approvals",
    inputSchema: ReviewCheckSchema.shape,
  },
  async (input) => {
    const result = await toolReviewCheck(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_reject",
  {
    description: "Dismiss a document from the internal review queue without requiring re-approval (e.g. for trivial changes)",
    inputSchema: ReviewRejectSchema.shape,
  },
  async (input) => {
    const result = await toolReviewReject(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "review_list",
  {
    description:
      "List all documents that have an approval record, with their review status (approved / pending_internal / pending_client / rejected). Use to answer questions like 'which SRS docs have been reviewed?', 'show all approved documents', or 'what is the review status of all documents'. Filter by status or logical path prefix.",
    inputSchema: ReviewListSchema.shape,
  },
  async (input) => {
    const result = await toolReviewList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "workspace_check",
  {
    description:
      "Validate workspace structure and config (required directories, docflow.config.json, language output folders, templates, context store, graph.json parseability). Structure/config only — use graph_validate for graph semantics. Pass fix:true to auto-create missing directories. Runs in pre-commit too.",
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
    "template_list", "template_inspect",
    "cocoindex_status", "cocoindex_stats", "cocoindex_index", "docs_search", "graph_query_fuzzy",
    "resolve_task",
    "review_approve", "review_status", "review_queue", "review_check", "review_reject", "review_list",
    "workspace_check",
    "context_list", "context_record", "context_resolve",
  ];
  process.stderr.write(
    `[ai-spector-mcp] v${pkg.version} started — ${toolNames.length} tools registered: ${toolNames.join(", ")}\n`,
  );
}
