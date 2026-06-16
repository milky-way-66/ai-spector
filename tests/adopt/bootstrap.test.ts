import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptBootstrap } from "@/core/adopt/bootstrap.js";
import { adoptArtifactPaths } from "@/core/adopt/paths.js";
import { loadAdoptSetup } from "@/core/adopt/setup.js";
import type { AdoptPlan } from "@/core/adopt/types.js";
import { workspaceIndexDocsPath } from "@/core/config/docflow-paths.js";
import { readJson, writeJson } from "@/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldBootstrapProject(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config/workspace"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify({
      version: 1,
      languages: [{ code: "en", label: "English" }],
      paths: {
        graph: ".ai-spector/graph/traceability.graph.json",
        registry: ".ai-spector/registry/section-registry.json",
        templates: ".ai-spector/templates",
      },
    }),
    "utf8",
  );
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
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await writeFile(
    join(root, "docs/srs/en/1-introduction.md"),
    "# Introduction\n\nMigrated overview.\n",
    "utf8",
  );
}

async function writeAppliedPlan(
  root: string,
  overrides: Partial<AdoptPlan> = {},
): Promise<void> {
  const paths = adoptArtifactPaths(root);
  const plan: AdoptPlan = {
    version: 1,
    status: "applied",
    approvedAt: new Date().toISOString(),
    approvedBy: "tester@example.com",
    moves: [],
    configPatches: [
      {
        path: ".ai-spector/docflow.config.json",
        set: {
          languages: [
            { code: "en", label: "English" },
            { code: "vi", label: "Vietnamese" },
          ],
        },
      },
    ],
    prototypeActions: [],
    warnings: [],
    blockingIssues: [],
    ...overrides,
  };
  await writeJson(paths.plan, plan);
}

describe("runAdoptBootstrap", () => {
  it("rejects when plan not applied", async () => {
    await withTempDir(async (root) => {
      await scaffoldBootstrapProject(root);
      const paths = adoptArtifactPaths(root);
      const approvedPlan: AdoptPlan = {
        version: 1,
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "tester@example.com",
        moves: [],
        configPatches: [],
        prototypeActions: [],
        warnings: [],
        blockingIssues: [],
      };
      await writeJson(paths.plan, approvedPlan);

      await expect(runAdoptBootstrap({ root })).rejects.toThrow(/applied/i);
    });
  });

  it("applies config patch and marks bootstrap.done", async () => {
    await withTempDir(async (root) => {
      await scaffoldBootstrapProject(root);
      await writeAppliedPlan(root);

      const result = await runAdoptBootstrap({ root });

      expect(result.steps.some((s) => s.id === "config-patches" && s.status === "ok")).toBe(true);
      expect(result.steps.some((s) => s.id === "analyze" && s.status === "skipped")).toBe(true);
      expect(result.steps.some((s) => s.id === "bootstrap.done")).toBe(false);

      const config = await readJson<{ languages: Array<{ code: string }> }>(
        join(root, ".ai-spector/docflow.config.json"),
      );
      expect(config.languages.map((l) => l.code)).toEqual(["en", "vi"]);

      const setup = await loadAdoptSetup(root);
      expect(setup.items["bootstrap.done"]?.done).toBe(true);
    });
  });
});
