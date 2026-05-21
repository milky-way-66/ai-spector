import { describe, expect, it } from "vitest";
import { InMemoryGraph } from "../../src/graph/InMemoryGraph.js";
import { mergePatch } from "../../src/graph/merge.js";
import { normalizeDataSourcePath } from "../../src/graph/provenance.js";
import {
  graphifyNodeTargetId,
  loadGraphifyIndex,
  repoPathForGraphifyNode,
} from "../../src/graphify/graph-index.js";
import { node } from "../helpers/graph.js";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("normalizeDataSourcePath", () => {
  it("maps knowledge-style sourceRef paths under docs/data-source", () => {
    expect(
      normalizeDataSourcePath(
        "requirement/SAKUSEN_TOKYO_Development_Request_Outline_v1.en.md §1-4",
        "docs/data-source",
      ),
    ).toBe(
      "docs/data-source/requirement/SAKUSEN_TOKYO_Development_Request_Outline_v1.en.md",
    );
  });
});

describe("derivedFrom path targets", () => {
  it("loads derivedFrom without a target node", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [node("UC-01", "useCase")],
      edges: [
        {
          type: "derivedFrom",
          from: "UC-01",
          to: "docs/data-source/interviews/uc01.md",
        },
      ],
    });
    expect(g.hasEdge({
      type: "derivedFrom",
      from: "UC-01",
      to: "docs/data-source/interviews/uc01.md",
    })).toBe(true);
  });

  it("mergePatch allows derivedFrom from domain nodes", () => {
    const g = InMemoryGraph.from({
      version: 1,
      nodes: [node("UC-01", "useCase")],
      edges: [],
    });
    const { stats } = mergePatch(g, {
      version: 1,
      nodes: [],
      edges: [
        {
          type: "derivedFrom",
          from: "UC-01",
          to: "docs/data-source/foo.ts",
        },
      ],
    });
    expect(stats.edgesAdded).toBe(1);
  });
});

describe("loadGraphifyIndex", () => {
  it("indexes nodes by repo path and label", async () => {
    const root = await mkdtemp(join(tmpdir(), "aispector-gf-"));
    const graphPath = join(root, "graph.json");
    await mkdir(join(root), { recursive: true });
    await writeFile(
      graphPath,
      JSON.stringify({
        nodes: [
          {
            id: "src_auth_login",
            label: "login()",
            source_file: "src/auth.ts",
          },
        ],
        links: [],
      }),
      "utf8",
    );

    const idx = await loadGraphifyIndex(graphPath, "docs/data-source");
    expect(idx?.byRepoPath.get("docs/data-source/src/auth.ts")).toEqual([
      "src_auth_login",
    ]);
    expect(repoPathForGraphifyNode(idx!.nodes[0]!, "docs/data-source")).toBe(
      "docs/data-source/src/auth.ts",
    );
    expect(graphifyNodeTargetId("src_auth_login")).toBe("graphify:src_auth_login");
  });
});
