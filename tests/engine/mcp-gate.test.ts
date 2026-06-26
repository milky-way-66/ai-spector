import { describe, expect, it } from "vitest";
import { gateMcpTool } from "../../src/core/engine/gate-mcp.js";
import type { DocopsConfig } from "../../src/core/docops/types.js";

const noGraph: DocopsConfig = {
  schemaVersion: "1.0",
  docsRoot: "docs",
  languages: [{ code: "en", label: "English" }],
  primaryLanguage: "en",
  paths: {
    comments: ".docops/comments",
    reviewConfig: ".docops/review.config.json",
    reviewQueue: ".docops/review-queue",
    prototypeConfig: ".docops/prototype/config.json",
    prototypeScreenMap: ".docops/prototype/screen-map.json",
  },
  capabilities: {
    review: true,
    comments: true,
    prototype: false,
    graph: false,
    generate: false,
    translate: false,
  },
};

describe("gateMcpTool", () => {
  it("blocks graph_query when graph disabled", () => {
    const result = gateMcpTool("graph_query", noGraph);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/graph/);
  });

  it("allows graph_query when graph enabled", () => {
    const cfg: DocopsConfig = {
      ...noGraph,
      capabilities: { ...noGraph.capabilities, graph: true },
    };
    expect(gateMcpTool("graph_query", cfg).allowed).toBe(true);
  });

  it("allows unmapped tools", () => {
    expect(gateMcpTool("knowledge_status", noGraph).allowed).toBe(true);
  });

  it("allows workspace_check regardless of capabilities", () => {
    expect(gateMcpTool("workspace_check", noGraph).allowed).toBe(true);
  });
});
