import { describe, expect, it } from "vitest";
import {
  activeSlotFor,
  getWorkflowTemplate,
  generateSlotFromPackOutputs,
  isCustomGenerateWorkflow,
  workflowForPackDocType,
} from "../../src/core/operations/task-templates.js";

describe("custom pack workflows", () => {
  it("resolves custom generate workflow template", () => {
    expect(isCustomGenerateWorkflow("generate-kaopiz-srs")).toBe(true);
    const t = getWorkflowTemplate("generate-kaopiz-srs");
    expect(t.kind).toBe("generate");
    expect(t.steps.length).toBeGreaterThan(4);
  });

  it("uses docType for active slot", () => {
    expect(
      activeSlotFor("generate", "generate-kaopiz-srs", "kaopiz-srs"),
    ).toBe("generate:kaopiz-srs");
  });

  it("maps workflow from pack docType", () => {
    expect(workflowForPackDocType("kaopiz-srs", "kaopiz-srs")).toBe(
      "generate-kaopiz-srs",
    );
    expect(workflowForPackDocType("srs", "builtin")).toBe("generate-srs");
  });

  it("matches pack output paths to slot", () => {
    const slot = generateSlotFromPackOutputs(
      "docs/requirements/introduction.md",
      "kaopiz-srs",
      [{ output: "docs/requirements/introduction.md" }],
    );
    expect(slot).toBe("generate:kaopiz-srs");
  });
});
