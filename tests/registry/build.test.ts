import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { bootstrapFromRegistry } from "../../src/commands/bootstrap.js";
import { buildSectionRegistry } from "../../src/registry/build.js";
import {
  BASIC_DESIGN_LIST_DOCUMENT_IDS,
  DEFAULT_BD_LIST_DOC,
} from "../../src/graph/defaults.js";

describe("buildSectionRegistry", () => {
  it("includes basic-design list chapters with template sections", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-spector-registry-"));
    await mkdir(join(root, ".ai-spector"), { recursive: true });
    await writeFile(
      join(root, ".ai-spector/docflow.config.json"),
      `${JSON.stringify({
        version: 1,
        paths: {
          graph: ".ai-spector/graph/traceability.graph.json",
          registry: ".ai-spector/registry/section-registry.json",
          templates: ".ai-spector/templates",
        },
      })}\n`,
    );

    const registry = await buildSectionRegistry(root);
    const apiList = registry.documents.find(
      (d) => d.documentId === DEFAULT_BD_LIST_DOC.apiList,
    );
    const screenList = registry.documents.find(
      (d) => d.documentId === DEFAULT_BD_LIST_DOC.screenList,
    );
    const dbDesign = registry.documents.find(
      (d) => d.documentId === DEFAULT_BD_LIST_DOC.dbDesign,
    );

    expect(apiList?.sections.length).toBeGreaterThan(0);
    expect(screenList?.sections.length).toBeGreaterThan(0);
    expect(dbDesign?.sections.length).toBeGreaterThan(0);

    const graph = bootstrapFromRegistry(registry);
    const issues = graph.validateStructure().filter((i) => i.ruleId === "DOC-SECTION-COVERAGE");
    const bdListIssues = issues.filter(
      (i) => i.nodeId != null && BASIC_DESIGN_LIST_DOCUMENT_IDS.has(i.nodeId),
    );
    expect(bdListIssues).toHaveLength(0);
  });
});
