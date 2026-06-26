import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAdoptCompletedTasks } from "@/core/adopt/tasks.js";
import { runCheck } from "@/core/operations/check.js";
import {
  buildGeneratePlan,
  runTaskApprovePlan,
  runTaskCreate,
  runTaskUpdate,
} from "@/core/operations/task.js";
import { pathExists, writeJson } from "@/core/util/fs.js";
import { passGenerateGates } from "../helpers/task-gate-fixture.js";
import { withTempDir } from "../helpers/temp-project.js";
import { MIN_DOCOPS, MIN_ENGINE, scaffoldDocopsMinimal } from "../helpers/docops-scaffold.js";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { ENGINE_CONFIG_REL } from "@/core/engine/paths.js";

async function scaffoldMinimal(root: string): Promise<void> {
  await scaffoldDocopsMinimal(root);
}

describe("runCheck", () => {
  it("flags missing config and required dirs on an empty workspace", async () => {
    await withTempDir(async (root) => {
      const result = await runCheck({ root });
      expect(result.ok).toBe(false);
      const ids = result.findings.map((f) => f.ruleId);
      expect(ids).toContain("STRUCT-002");
      expect(ids).toContain("STRUCT-001");
      expect(result.findings.some((f) => f.ruleId === "STRUCT-002" && f.severity === "error")).toBe(true);
    });
  });

  it("passes on a well-formed workspace", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      const result = await runCheck({ root });
      expect(result.ok).toBe(true);
      expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    });
  });

  it("--fix creates auto-fixable directories and marks them fixed", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".docops"), { recursive: true });
      await writeFile(
        join(root, DOCOPS_CONFIG_REL),
        JSON.stringify(MIN_DOCOPS),
        "utf8",
      );
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeJson(join(root, ENGINE_CONFIG_REL), MIN_ENGINE);
      const result = await runCheck({ root, fix: true });
      expect(await pathExists(join(root, "docs/data-source"))).toBe(true);
      expect(await pathExists(join(root, ".ai-spector/.docflow/config"))).toBe(true);
      const struct001 = result.findings.filter((f) => f.ruleId === "STRUCT-001");
      expect(struct001.length).toBeGreaterThan(0);
      expect(struct001.every((f) => f.fixed)).toBe(true);
    });
  });

  it("warns (not errors) when graph.json is unparseable", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await mkdir(join(root, ".ai-spector/graph"), { recursive: true });
      await writeFile(join(root, ".ai-spector/graph/traceability.graph.json"), "{ not json", "utf8");
      const result = await runCheck({ root });
      const graph = result.findings.find((f) => f.ruleId === "GRAPH-001");
      expect(graph?.severity).toBe("warning");
      // unparseable graph is a warning only — workspace still passes
      expect(result.ok).toBe(true);
    });
  });

  it("flags misplaced SRS docs with STRUCT-004", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(join(root, "docs/srs/3-use-cases.md"), "# Use cases\n", "utf8");
      const result = await runCheck({ root });
      const misplaced = result.findings.find((f) => f.ruleId === "STRUCT-004");
      expect(misplaced?.severity).toBe("error");
      expect(misplaced?.path).toBe("docs/srs/3-use-cases.md");
      expect(misplaced?.fix).toContain("docs/srs/en/3-use-cases.md");
      expect(result.ok).toBe(false);
    });
  });

  it("validates explicit paths without scanning the whole tree", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      const okPath = await runCheck({ root, paths: ["docs/srs/en/3-use-cases.md"] });
      expect(okPath.findings.some((f) => f.ruleId === "STRUCT-004")).toBe(false);

      const badPath = await runCheck({ root, paths: ["docs/srs/3-use-cases.md"] });
      expect(badPath.findings.some((f) => f.ruleId === "STRUCT-004")).toBe(true);
      expect(badPath.ok).toBe(false);
    });
  });

  it("warns TASK-002 when SRS docs exist without active generate task", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(
        join(root, "docs/srs/en/1-introduction.md"),
        "# Introduction\n",
        "utf8",
      );
      const result = await runCheck({ root });
      const task002 = result.findings.find((f) => f.ruleId === "TASK-002");
      expect(task002?.severity).toBe("warning");
      expect(task002?.message).toContain("generate:srs");
      expect(task002?.fix).toContain("task_create");
      expect(result.ok).toBe(true);
    });
  });

  it("warns TASK-003 on explicit SRS path without approved generate task", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      const rel = "docs/srs/en/1-introduction.md";
      await writeFile(join(root, rel), "# Introduction\n", "utf8");
      const result = await runCheck({ root, paths: [rel] });
      const task003 = result.findings.find((f) => f.ruleId === "TASK-003");
      expect(task003?.severity).toBe("warning");
      expect(result.ok).toBe(true);
    });
  });

  it("passes TASK-003 when active generate task has approved plan", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      const rel = "docs/srs/en/1-introduction.md";
      const created = await runTaskCreate({
        root,
        kind: "generate",
        workflow: "generate-srs",
        trigger: "generate introduction",
        docType: "srs",
      });
      const plan = buildGeneratePlan({
        docType: "srs",
        language: "en",
        scope: "explicit",
        briefing: [{ target: rel }],
        rows: [
          {
            output: rel,
            dagNode: "srs.introduction",
            sources: [],
            keyPoints: ["intro"],
          },
        ],
        waves: [{ wave: 1, nodeIds: ["srs.introduction"] }],
      });
      await passGenerateGates(root, created.task.id, plan);
      await runTaskApprovePlan({ root, taskId: created.task.id });
      await writeFile(join(root, rel), "# Introduction\n", "utf8");
      const result = await runCheck({ root, paths: [rel] });
      expect(result.findings.some((f) => f.ruleId === "TASK-003")).toBe(false);
      expect(result.ok).toBe(true);
    });
  });

  it("warns ADOPT-001 when flat SRS exists and migration not complete", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(join(root, "docs/srs/3-use-cases.md"), "# Use cases\n", "utf8");
      const result = await runCheck({ root });
      const adopt = result.findings.find((f) => f.ruleId === "ADOPT-001");
      expect(adopt?.severity).toBe("warning");
      expect(adopt?.message).toContain("npx ai-spector adopt scan");
      expect(adopt?.fix).toBe("npx ai-spector adopt scan");
      expect(result.ok).toBe(false);
    });
  });

  it("suppresses TASK-002 when adopt completed task exists in recent", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(
        join(root, "docs/srs/en/1-introduction.md"),
        "# Introduction\n",
        "utf8",
      );
      await createAdoptCompletedTasks({ root });
      const result = await runCheck({ root });
      expect(result.findings.some((f) => f.ruleId === "TASK-002")).toBe(false);
      expect(result.ok).toBe(true);
    });
  });

  it("flags empty languages[] as a CFG-001 error", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(
        join(root, DOCOPS_CONFIG_REL),
        JSON.stringify({ ...MIN_DOCOPS, languages: [] }),
        "utf8",
      );
      const result = await runCheck({ root });
      expect(result.findings.some((f) => f.ruleId === "CFG-001" && f.severity === "error")).toBe(true);
      expect(result.ok).toBe(false);
    });
  });
});
