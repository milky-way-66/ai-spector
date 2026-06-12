import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCheck } from "../../src/core/operations/check.js";
import { pathExists } from "../../src/core/util/fs.js";
import { withTempDir } from "../helpers/temp-project.js";

const MIN_CONFIG = {
  languages: [{ code: "en", label: "English" }],
  paths: { graph: ".ai-spector/graph/traceability.json" },
};

async function scaffoldMinimal(root: string): Promise<void> {
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeFile(
    join(root, ".ai-spector/docflow.config.json"),
    JSON.stringify(MIN_CONFIG),
    "utf8",
  );
  await mkdir(join(root, "docs/data-source"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await mkdir(join(root, ".ai-spector/templates"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/context"), { recursive: true });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
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
      await mkdir(join(root, ".ai-spector"), { recursive: true });
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify(MIN_CONFIG),
        "utf8",
      );
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
      await writeFile(join(root, ".ai-spector/graph/traceability.json"), "{ not json", "utf8");
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

  it("flags empty languages[] as a CFG-001 error", async () => {
    await withTempDir(async (root) => {
      await scaffoldMinimal(root);
      await writeFile(
        join(root, ".ai-spector/docflow.config.json"),
        JSON.stringify({ ...MIN_CONFIG, languages: [] }),
        "utf8",
      );
      const result = await runCheck({ root });
      expect(result.findings.some((f) => f.ruleId === "CFG-001" && f.severity === "error")).toBe(true);
      expect(result.ok).toBe(false);
    });
  });
});
