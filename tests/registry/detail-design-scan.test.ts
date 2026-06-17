import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanDetailDesignListDocuments } from "@/core/registry/build.js";

describe("scanDetailDesignListDocuments", () => {
  it("scans seven detail design list templates", async () => {
    const root = await mkdtemp(join(tmpdir(), "dd-scan-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      `${JSON.stringify({
        version: 1,
        languages: [{ code: "en", label: "English" }],
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
        packs: { srs: "builtin", basicDesign: "builtin" },
      })}\n`,
    );

    const docs = await scanDetailDesignListDocuments(root);
    expect(docs).toHaveLength(7);
    expect(docs.some((d) => d.documentId === "doc.dd.feature-list")).toBe(true);
    expect(docs.find((d) => d.documentId === "doc.dd.feature-list")?.sections.length).toBeGreaterThan(
      0,
    );
  });
});
