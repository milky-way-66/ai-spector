import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptApply } from "@/core/adopt/apply.js";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";
import { loadAdoptSetup } from "@/core/adopt/setup.js";
import type { AdoptPlan } from "@/core/adopt/types.js";
import { pathExists, readJson, writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldInit(root: string) {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({ languages: [{ code: "en", label: "English" }] }),
    "utf8",
  );
}

async function writeApprovedPlanWithMove(root: string) {
  const paths = adoptArtifactPaths(root);
  const plan: AdoptPlan = {
    version: 1,
    status: "approved",
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
  await mkdir(join(root, "docs/srs"), { recursive: true });
  await writeFile(join(root, "docs/srs/1-introduction.md"), "# Introduction\n", "utf8");
}

describe("runAdoptApply", () => {
  it("rejects apply when plan not approved", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      const paths = adoptArtifactPaths(root);
      const draftPlan: AdoptPlan = {
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
      await writeJson(paths.plan, draftPlan);

      await expect(runAdoptApply({ root, legacy: true })).rejects.toThrow(/approved/i);
    });
  });

  it("moves file and sets plan status applied", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await writeApprovedPlanWithMove(root);
      const paths = adoptArtifactPaths(root);

      const result = await runAdoptApply({ root, legacy: true });

      expect(result.moved).toBe(1);
      expect(result.dryRun).toBe(false);
      expect(await pathExists(join(root, "docs/srs/en/1-introduction.md"))).toBe(true);
      expect(await pathExists(join(root, "docs/srs/1-introduction.md"))).toBe(false);

      const plan = await readJson<AdoptPlan>(paths.plan);
      expect(plan.status).toBe("applied");

      const setup = await loadAdoptSetup(root);
      expect(setup.items["apply.done"]?.done).toBe(true);
    });
  });

  it("dryRun does not move files", async () => {
    await withTempDir(async (root) => {
      await scaffoldInit(root);
      await writeApprovedPlanWithMove(root);

      const result = await runAdoptApply({ root, dryRun: true, legacy: true });

      expect(result.dryRun).toBe(true);
      expect(result.moved).toBe(0);
      expect(result.moves).toEqual([
        { from: "docs/srs/1-introduction.md", to: "docs/srs/en/1-introduction.md" },
      ]);
      expect(await pathExists(join(root, "docs/srs/1-introduction.md"))).toBe(true);
      expect(await pathExists(join(root, "docs/srs/en/1-introduction.md"))).toBe(false);

      const paths = adoptArtifactPaths(root);
      const plan = await readJson<AdoptPlan>(paths.plan);
      expect(plan.status).toBe("approved");
    });
  });
});
