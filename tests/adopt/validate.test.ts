import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";
import { markAdoptSetupItem } from "@/core/adopt/setup.js";
import type { AdoptPlan } from "@/core/adopt/types.js";
import { validateAdopt } from "@/core/adopt/validate.js";
import { createAdoptCompletedTasks } from "@/core/adopt/tasks.js";
import { workspaceIndexDocsPath } from "@/core/config/docflow-paths.js";
import { writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";
import { scaffoldDocopsMinimal } from "../helpers/docops-scaffold.js";

async function scaffoldValidateProject(root: string): Promise<void> {
  await scaffoldDocopsMinimal(root);
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await writeJson(workspaceIndexDocsPath(root), {
    version: 1,
    outputs: {
      srs: ".ai-spector/index/srs.md",
      basicDesign: ".ai-spector/index/basic-design.md",
    },
    sources: {
      srs: { root: "docs/srs", glob: "**/*.md" },
      basicDesign: { root: "docs/basic-design", glob: "**/*.md" },
    },
  });
  await writeJson(join(root, ".ai-spector/.docflow/tasks/index.json"), {
    version: 1,
    active: {},
    recent: [],
  });
}

async function writeDraftPlan(root: string): Promise<void> {
  const paths = adoptArtifactPaths(root);
  const plan: AdoptPlan = {
    version: 1,
    status: "draft",
    approvedAt: null,
    approvedBy: null,
    moves: [],
    configPatches: [],
    prototypeActions: [],
    warnings: [],
    blockingIssues: [],
  };
  await writeJson(paths.plan, plan);
}

async function writeAppliedPlan(root: string): Promise<void> {
  const paths = adoptArtifactPaths(root);
  const plan: AdoptPlan = {
    version: 1,
    status: "applied",
    approvedAt: new Date().toISOString(),
    approvedBy: "tester@example.com",
    moves: [
      {
        from: "docs/srs/1-introduction.md",
        to: "docs/srs/en/1-introduction.md",
        layer: "srs",
        confidence: "high",
        reason: "canonical language folder mapping",
      },
    ],
    configPatches: [],
    prototypeActions: [],
    warnings: [],
    blockingIssues: [],
  };
  await writeJson(paths.plan, plan);
}

async function scaffoldReadyMigration(root: string): Promise<void> {
  await scaffoldValidateProject(root);
  await writeAppliedPlan(root);
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await writeFile(
    join(root, "docs/srs/en/1-introduction.md"),
    "# Introduction\n\nMigrated overview.\n",
    "utf8",
  );
  await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
  await mkdir(join(root, ".ai-spector/registry"), { recursive: true });
  await writeJson(join(root, ".ai-spector/graph/traceability.graph.json"), {
    version: 1,
    nodes: [
      { id: "doc.srs.introduction", type: "document", title: "Introduction" },
      { id: "doc.srs.introduction.s1", type: "section", heading: "Overview", level: 2 },
    ],
    edges: [
      { type: "partOf", from: "doc.srs.introduction.s1", to: "doc.srs.introduction" },
      { type: "contains", from: "doc.srs.introduction", to: "doc.srs.introduction.s1" },
    ],
  });
  await writeJson(join(root, ".ai-spector/registry/section-registry.json"), {
    version: 1,
    documents: [],
  });
  await markAdoptSetupItem(root, "bootstrap.done");
  await createAdoptCompletedTasks({ root });
}

describe("validateAdopt", () => {
  it("returns ready false when plan not applied", async () => {
    await withTempDir(async (root) => {
      await scaffoldValidateProject(root);
      await writeDraftPlan(root);

      const v = await validateAdopt({ root });

      expect(v.ready).toBe(false);
      expect(v.blockingCount).toBeGreaterThan(0);
      expect(v.gaps.some((g) => g.id === "plan.not-applied" && g.severity === "blocking")).toBe(
        true,
      );
    });
  });

  it("rejects setup-mark migration.complete when not ready", async () => {
    await withTempDir(async (root) => {
      await scaffoldValidateProject(root);
      await writeDraftPlan(root);

      await expect(markAdoptSetupItem(root, "migration.complete")).rejects.toThrow(/ready/i);
    });
  });

  it("returns ready true after full migration fixture", async () => {
    await withTempDir(async (root) => {
      await scaffoldReadyMigration(root);

      const v = await validateAdopt({ root });

      expect(v.ready).toBe(true);
      expect(v.blockingCount).toBe(0);
      expect(v.gaps.filter((g) => g.severity === "blocking")).toHaveLength(0);
    });
  });

  it("suggests derive-downstream when basic + detail exist but SRS is missing", async () => {
    await withTempDir(async (root) => {
      await scaffoldValidateProject(root);
      await writeAppliedPlan(root);
      await mkdir(join(root, "docs/basic-design/en"), { recursive: true });
      await mkdir(join(root, "docs/detail-design/en"), { recursive: true });
      await writeFile(join(root, "docs/basic-design/en/screen-list.md"), "# Screens\n", "utf8");
      await writeFile(join(root, "docs/detail-design/en/feature-list.md"), "# Features\n", "utf8");
      await markAdoptSetupItem(root, "bootstrap.done");
      await createAdoptCompletedTasks({ root });

      const v = await validateAdopt({ root });

      const deriveGap = v.gaps.find((g) => g.id === "derive.srs-missing");
      expect(deriveGap).toMatchObject({
        severity: "warning",
        suggestion: "generate-srs",
        deriveFrom: ["basic-design", "detail-design"],
      });
      expect(v.questionsForUser.some((q) => /backfill|derive-downstream/i.test(q))).toBe(true);
    });
  });
});
