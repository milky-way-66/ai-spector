import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runDocSemanticMerge } from "@/core/index/doc-semantics.js";
import { readJson } from "@/core/util/fs.js";

describe("runDocSemanticMerge detail design", () => {
  it("merges doc.dd.f-01 from docs/detail-design feature files", async () => {
    const root = await mkdtemp(join(tmpdir(), "dd-semantics-"));
    const ai = join(root, ".ai-spector");
    await mkdir(join(ai, ".docflow/config/workspace"), { recursive: true });
    await mkdir(join(ai, "graph"), { recursive: true });
    await mkdir(join(root, "docs/detail-design/en/features"), { recursive: true });

    await writeFile(
      join(ai, "docflow.config.json"),
      `${JSON.stringify({
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
        },
        packs: { srs: "builtin", basicDesign: "builtin" },
      })}\n`,
    );

    await writeFile(
      join(ai, ".docflow/config/workspace/index.docs.json"),
      `${JSON.stringify({
        version: 1,
        outputs: {
          srs: ".ai-spector/index/srs.md",
          basicDesign: ".ai-spector/index/basic-design.md",
          detailDesign: ".ai-spector/index/detail-design.md",
        },
        sources: {
          detailDesign: { root: "docs/detail-design", glob: "**/*.md" },
        },
      })}\n`,
    );

    await writeFile(
      join(ai, "graph/traceability.graph.json"),
      `${JSON.stringify({
        version: 1,
        nodes: [
          { id: "F-01", type: "feature", title: "Checkout" },
          { id: "doc.dd.feature-list", type: "document", output: "docs/detail-design/feature-list.md" },
        ],
        edges: [],
      })}\n`,
    );

    await writeFile(
      join(root, "docs/detail-design/en/features/f-01-checkout.md"),
      `# Detail Design: Checkout

**Feature Name:** Checkout

## 1. Feature Implementation Overview
`,
    );

    const result = await runDocSemanticMerge({
      projectRoot: root,
      graphPath: join(ai, "graph/traceability.graph.json"),
    });

    expect(result.merged).toBe(true);
    expect(result.detail).toContain("detail-design");

    const graph = await readJson<{ nodes: Array<{ id: string }> }>(
      join(ai, "graph/traceability.graph.json"),
    );
    expect(graph.nodes.some((n) => n.id === "doc.dd.f-01")).toBe(true);
  });
});
