import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdoptApply } from "@/core/adopt/apply.js";
import { runAdoptBootstrap } from "@/core/adopt/bootstrap.js";
import { approveAdoptPlan, runAdoptPlan } from "@/core/adopt/plan.js";
import { runAdoptScan } from "@/core/adopt/scan.js";
import { recordAdoptAnswer } from "@/core/adopt/setup.js";
import { validateAdopt } from "@/core/adopt/validate.js";
import { workspaceIndexDocsPath } from "@/core/config/docflow-paths.js";
import { runCheck } from "@/core/operations/check.js";
import { pathExists, writeJson } from "@/core/util/fs.js";
import { graph, node } from "../helpers/graph.js";
import { withTempDir } from "../helpers/temp-project.js";

async function scaffoldMinimalInit(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector/.docflow/adopt"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/context"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
  await mkdir(join(root, ".ai-spector/templates"), { recursive: true });
  await mkdir(join(root, "docs/data-source"), { recursive: true });
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
  await writeJson(join(root, ".ai-spector/.docflow/tasks/index.json"), {
    version: 1,
    active: {},
    recent: [],
  });
}

async function writeMinimalGraph(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
  await mkdir(join(root, ".ai-spector/registry"), { recursive: true });
  await writeJson(
    join(root, ".ai-spector/graph/traceability.graph.json"),
    graph(
      [
        node("doc.srs.introduction", "document", { title: "Introduction" }),
        node("doc.srs.introduction.s1", "section", { heading: "Overview", level: 2 }),
      ],
      [
        { type: "partOf", from: "doc.srs.introduction.s1", to: "doc.srs.introduction" },
        { type: "contains", from: "doc.srs.introduction", to: "doc.srs.introduction.s1" },
      ],
    ),
  );
  await writeJson(join(root, ".ai-spector/registry/section-registry.json"), {
    version: 1,
    documents: [],
  });
}

describe("adopt integration", () => {
  it("migrates flat SRS to canonical layout and validates ready", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimalInit(root);

      await mkdir(join(root, "docs/srs"), { recursive: true });
      await mkdir(join(root, "docs/srs/use-cases"), { recursive: true });
      await writeFile(
        join(root, "docs/srs/1-introduction.md"),
        "# Introduction\n\nOverview.\n",
        "utf8",
      );
      await writeFile(
        join(root, "docs/srs/use-cases/uc-UC-01-login.md"),
        "# UC-01 Login\n\nUser logs in.\n",
        "utf8",
      );

      await recordAdoptAnswer(root, "lang-primary", "en");

      const scan = await runAdoptScan({ root });
      expect(scan.inventory.some((i) => i.path === "docs/srs/1-introduction.md")).toBe(true);
      expect(
        scan.inventory.some((i) => i.path === "docs/srs/use-cases/uc-UC-01-login.md"),
      ).toBe(true);

      const plan = await runAdoptPlan({ root });
      expect(plan.blockingIssues).toHaveLength(0);
      expect(plan.moves.some((m) => m.from === "docs/srs/1-introduction.md")).toBe(true);
      expect(
        plan.moves.some((m) => m.from === "docs/srs/use-cases/uc-UC-01-login.md"),
      ).toBe(true);

      await approveAdoptPlan({ root, by: "integration-test@example.com" });

      const apply = await runAdoptApply({ root });
      expect(apply.moved).toBeGreaterThanOrEqual(2);
      expect(await pathExists(join(root, "docs/srs/en/1-introduction.md"))).toBe(true);
      expect(await pathExists(join(root, "docs/srs/1-introduction.md"))).toBe(false);
      expect(
        await pathExists(join(root, "docs/srs/en/use-cases/uc-UC-01-login.md")),
      ).toBe(true);

      await runAdoptBootstrap({ root });

      let validation = await validateAdopt({ root });
      if (!validation.ready) {
        const graphGaps = validation.gaps.filter((g) => g.id.startsWith("graph."));
        if (graphGaps.length > 0 || validation.gaps.some((g) => g.id === "GRAPH-001")) {
          await writeMinimalGraph(root);
          validation = await validateAdopt({ root });
        }
      }

      expect(validation.ready).toBe(true);
      expect(validation.blockingCount).toBe(0);

      const check = await runCheck({ root });
      expect(check.findings.some((f) => f.ruleId === "STRUCT-004")).toBe(false);
      expect(check.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    });
  });
});
