import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdoptPlan } from "@/core/adopt/types.js";
import { buildAdoptPlanSummary } from "@/core/operations/adopt-plan.js";
import { runTaskCreate } from "@/core/operations/task.js";
import {
  activeSlotFor,
  getWorkflowTemplate,
  WORKFLOW_TEMPLATES,
} from "@/core/operations/task-templates.js";
import { withTempDir } from "../helpers/temp-project.js";

describe("adopt workflow template", () => {
  it("registers adopt workflow with 7 steps", () => {
    expect(WORKFLOW_TEMPLATES.adopt).toBeDefined();
    expect(WORKFLOW_TEMPLATES.adopt.kind).toBe("adopt");
    const steps = getWorkflowTemplate("adopt").steps.map((s) => s.id);
    expect(steps).toEqual([
      "check",
      "clarify",
      "plan",
      "apply",
      "bootstrap",
      "validate",
      "complete",
    ]);
  });

  it("uses adopt slot", () => {
    expect(activeSlotFor("adopt", "adopt")).toBe("adopt");
  });
});

describe("adopt task_create", () => {
  it("creates adopt task with 7 steps", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
        "utf8",
      );
      const { task } = await runTaskCreate({
        root,
        kind: "adopt",
        workflow: "adopt",
        trigger: "align legacy docs",
      });
      expect(task.kind).toBe("adopt");
      expect(task.steps).toHaveLength(7);
    });
  });
});

describe("buildAdoptPlanSummary", () => {
  it("counts moves per layer including detail-design", () => {
    const plan: AdoptPlan = {
      version: 1,
      status: "draft",
      approvedAt: null,
      approvedBy: null,
      moves: [
        {
          from: "docs/srs/a.md",
          to: "docs/srs/en/a.md",
          layer: "srs",
          confidence: "high",
          reason: "test",
        },
        {
          from: "docs/dd/f.md",
          to: "docs/detail-design/en/features/f.md",
          layer: "detail-design",
          confidence: "medium",
          reason: "test",
        },
      ],
      configPatches: [],
      prototypeActions: [],
      warnings: [],
      blockingIssues: [],
    };
    const summary = buildAdoptPlanSummary(plan, {
      srs: "reshaped",
      basicDesign: "missing",
      detailDesign: "reshaped",
      prototype: "missing",
      languages: { detected: ["en"], strategy: "flat" },
      dataSource: "absent",
      activePack: "builtin",
    });
    expect(summary.moveCount).toBe(2);
    expect(summary.layers.detailDesign).toBe(1);
    expect(summary.lowConfidenceCount).toBe(0);
  });
});
