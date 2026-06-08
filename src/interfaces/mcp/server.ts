#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";

import {
  GraphQuerySchema,
  GraphImpactSchema,
  GraphValidateSchema,
  GraphMergeSchema,
  IndexSchema,
  CommentsListSchema,
  CommentsInboxSchema,
  CommentsShowSchema,
  CommentsResolveSchema,
  TemplateListSchema,
  TemplateInspectSchema,
} from "./schemas.js";

import { toolGraphQuery, toolGraphImpact, toolGraphValidate, toolGraphMerge } from "./tools/graph.js";
import { toolIndex } from "./tools/index.js";
import {
  toolCommentsList,
  toolCommentsInbox,
  toolCommentsShow,
  toolCommentsResolve,
} from "./tools/comments.js";
import { toolTemplateList, toolTemplateInspect } from "./tools/template.js";

const require = createRequire(import.meta.url);
const pkg = require("../../../package.json") as { version: string };

const server = new McpServer({
  name: "ai-spector",
  version: pkg.version,
});

// ── Graph tools ───────────────────────────────────────────────────────────────

server.tool(
  "graph_query",
  "Walk the traceability graph from a seed node and return connected nodes and edges",
  GraphQuerySchema.shape,
  async (input) => {
    const result = await toolGraphQuery(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "graph_impact",
  "Compute impact analysis for a change — returns which documents/sections need to be regenerated or reviewed",
  GraphImpactSchema.shape,
  async (input) => {
    const result = await toolGraphImpact(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "graph_validate",
  "Validate the traceability graph against schema and traceability rules",
  GraphValidateSchema.shape,
  async (input) => {
    const result = await toolGraphValidate(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "graph_merge",
  "Merge AI-extracted knowledge (knowledge.json) into the traceability graph",
  GraphMergeSchema.shape,
  async (input) => {
    const result = await toolGraphMerge(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Index tool ────────────────────────────────────────────────────────────────

server.tool(
  "index",
  "Re-index the project: rebuild graph structure, merge knowledge, build doc indexes",
  IndexSchema.shape,
  async (input) => {
    const result = await toolIndex(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Comment tools ─────────────────────────────────────────────────────────────

server.tool(
  "comments_list",
  "List review comment threads, optionally filtered by file or status",
  CommentsListSchema.shape,
  async (input) => {
    const result = await toolCommentsList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "comments_inbox",
  "Get the structured comment inbox with priority ordering and IDE presentation hints",
  CommentsInboxSchema.shape,
  async (input) => {
    const result = await toolCommentsInbox(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "comments_show",
  "Get full detail of a single comment thread by id",
  CommentsShowSchema.shape,
  async (input) => {
    const result = await toolCommentsShow(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "comments_resolve",
  "Resolve a comment thread",
  CommentsResolveSchema.shape,
  async (input) => {
    const result = await toolCommentsResolve(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Template tools ────────────────────────────────────────────────────────────

server.tool(
  "template_list",
  "List installed template packs and show which is active",
  TemplateListSchema.shape,
  async (input) => {
    const result = await toolTemplateList(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "template_inspect",
  "Inspect a template pack — returns its manifest and available documents",
  TemplateInspectSchema.shape,
  async (input) => {
    const result = await toolTemplateInspect(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
