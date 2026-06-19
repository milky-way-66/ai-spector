import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessReadiness } from "@/core/readiness/assess.js";
import { evaluateWorkflowStep } from "@/core/workflow/dependencies.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/derive-bd-dd-no-srs");

describe("derive-bd-dd-no-srs fixture", () => {
  it("passes derive-downstream gates without knowledge.json", async () => {
    const wf = await evaluateWorkflowStep(FIXTURE, {
      stepId: "generate-srs",
      sourceMode: "derive-downstream",
    });
    expect(wf.ok).toBe(true);

    const readiness = await assessReadiness({
      root: FIXTURE,
      docType: "srs",
      sourceMode: "derive-downstream",
      workflow: "generate-srs",
    });
    expect(readiness.ready).toBe(true);
  });
});
