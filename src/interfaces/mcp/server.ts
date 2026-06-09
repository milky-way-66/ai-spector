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
  AnalyzeSchema,
  KnowledgeStatusSchema,
  KnowledgeValidateSchema,
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
  CocoindexIndexSchema,
} from "./schemas.js";

import { toolGraphQuery, toolGraphImpact, toolGraphValidate, toolGraphMerge, toolGraphReport } from "./tools/graph.js";
import { toolAnalyze, toolKnowledgeStatus, toolKnowledgeValidate } from "./tools/analyze.js";
import { toolLangQueue } from "./tools/lang.js";
import { toolIndex } from "./tools/index.js";
import {
  toolCommentsList,
  toolCommentsInbox,
  toolCommentsShow,
  toolCommentsResolve,
} from "./tools/comments.js";
import { toolTemplateList, toolTemplateInspect } from "./tools/template.js";
import { toolDocsSearch, toolGraphQueryFuzzy, toolCocoindexStatus, toolCocoindexIndex } from "./tools/cocoindex.js";

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

// ── Analyze / Knowledge tools ─────────────────────────────────────────────────

server.registerTool(
  "analyze",
  {
    description:
      "Prepare graph scaffold from project templates — creates section/document nodes and writes the section registry. Run before entity extraction. Replaces `npx ai-spector analyze` for the structure-prep step.",
    inputSchema: AnalyzeSchema.shape,
  },
  async (input) => {
    const result = await toolAnalyze(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

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

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
