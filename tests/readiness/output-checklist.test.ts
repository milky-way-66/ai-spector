import { describe, expect, it } from "vitest";
import {
  buildReadinessOutputChecklist,
  resolveDagNodeForPath,
} from "../../src/core/readiness/output-checklist.js";

describe("resolveDagNodeForPath", () => {
  const dag = {
    nodes: [
      { id: "srs.introduction", output: "1-introduction.md" },
      { id: "srs.feature-details", output: "features/" },
    ],
  };

  it("matches exact output filename", () => {
    const node = resolveDagNodeForPath("docs/srs/en/1-introduction.md", dag);
    expect(node?.id).toBe("srs.introduction");
  });

  it("matches directory output prefix", () => {
    const node = resolveDagNodeForPath("docs/srs/en/features/F-01.md", dag);
    expect(node?.id).toBe("srs.feature-details");
  });
});

describe("buildReadinessOutputChecklist", () => {
  it("returns checklist items for a builtin SRS path", async () => {
    const root = new URL("../../scaffold", import.meta.url).pathname;
    const result = await buildReadinessOutputChecklist({
      root,
      docType: "srs",
      paths: ["docs/srs/en/1-introduction.md"],
    });
    expect(result.checklists).toHaveLength(1);
    expect(result.checklists[0]?.dagNode).toBe("srs.introduction");
    expect(result.checklists[0]?.items.length).toBeGreaterThan(0);
    expect(result.checklists[0]?.iso29148Sections.length).toBeGreaterThan(0);
    expect(result.workflow.length).toBeGreaterThan(2);
  });
});
