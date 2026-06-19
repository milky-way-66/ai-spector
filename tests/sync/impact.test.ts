import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { computeAuditImpact } from "@/core/sync/impact.js";
import { bundledRulesImpactPath } from "@/core/config/load.js";
import { graph, loadGraph, node } from "../helpers/graph.js";

describe("computeAuditImpact", () => {
  it("merges syncUpstream for changed BD path with direction both", async () => {
    const nodes = [
      node("doc.bd", "document", { output: "docs/basic-design/en/api-list.md" }),
      node("sec.f", "section"),
      node("feat.auth", "feature"),
      node("doc.srs.f", "document", { output: "docs/srs/en/features/F-03.md" }),
    ];
    const edges = [
      { type: "partOf", from: "sec.f", to: "doc.bd" },
      { type: "listedIn", from: "feat.auth", to: "sec.f" },
      { type: "tracesTo", from: "doc.srs.f", to: "feat.auth" },
      { type: "rendersTo", from: "sec.f", to: "docs/basic-design/en/api-list.md" },
    ];
    loadGraph(nodes, edges);

    const tmp = await mkdtemp(join(tmpdir(), "sync-impact-"));
    const graphPath = join(tmp, "graph.json");
    await writeFile(graphPath, JSON.stringify(graph(nodes, edges)));

    const impact = await computeAuditImpact({
      graphPath,
      rulesPath: bundledRulesImpactPath(),
      changedPaths: ["docs/basic-design/en/api-list.md"],
      direction: "both",
    });

    expect(impact.syncUpstream?.map((e) => e.id)).toContain("feat.auth");
    expect(impact.regenerate.length + impact.review.length).toBeGreaterThan(0);
  });

  it("returns noTraceabilityImpact when no origins resolve", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "sync-impact-empty-"));
    const graphPath = join(tmp, "graph.json");
    await writeFile(graphPath, JSON.stringify(graph([], [])));

    const impact = await computeAuditImpact({
      graphPath,
      rulesPath: bundledRulesImpactPath(),
      changedPaths: ["docs/basic-design/missing.md"],
      direction: "both",
    });

    expect(impact.noTraceabilityImpact).toBe(true);
    expect(impact.syncUpstream).toEqual([]);
  });
});
